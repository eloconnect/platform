import {
  acessoManualEmVigor,
  formatarCnpj,
  formatarDia,
  podeAcessarRecursoRestrito,
  type DecidirCancelamentoRequest,
  type PedidoCancelamento,
} from '@eloconnect/shared';
import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ultimoDiaComAcesso } from '../associados/associados.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { hojeEmMatoGrosso, textoDia } from '../cobranca/valor-do-mes.js';
import { EmailService } from '../email/email.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { prazoVencidoAntesDe, respostaAte } from './prazo.js';

type Tx = Prisma.TransactionClient;

/** O que os avisos por e-mail precisam do associado. */
const DADOS_AVISO = {
  id: true,
  cnpj: true,
  razaoSocial: true,
  nomeFantasia: true,
  email: true,
  situacao: true,
  acessoManual: true,
  acessoManualAte: true,
} satisfies Prisma.AssociadoSelect;

type DadosAviso = Prisma.AssociadoGetPayload<{ select: typeof DADOS_AVISO }>;

/** Resultado do job diário da confirmação automática. */
export interface ResultadoConfirmacao {
  /** Dia da execução em Mato Grosso ("AAAA-MM-DD"). */
  dia: string;
  /** Pedidos confirmados sem resposta da sede nesta execução. */
  confirmados: number;
}

/**
 * Confirmado o cancelamento, a farmácia deixa de receber o boleto mensal e
 * os lembretes. Como na interrupção pela sede (RN25), quem estava em dia
 * mantém o acesso por mais 30 dias, e o boleto que já saiu continua valendo.
 * TODO(P25): o cliente ainda não disse o que acontece com o acesso e com o
 * boleto do mês depois do cancelamento (decisão do grupo, 02/11/2026).
 * Devolve falso se a farmácia já não recebia o boleto.
 */
async function encerrarCobranca(
  tx: Tx,
  associadoId: string,
  agora: Date,
): Promise<boolean> {
  const { count } = await tx.associado.updateMany({
    where: { id: associadoId, contribuicaoAtiva: true },
    data: { contribuicaoAtiva: false, cobrancaInterrompidaEm: agora },
  });
  return count > 0;
}

/**
 * Cancelamento do boleto mensal (RN18). O associado pede pela área dele
 * (US26: RF26), e a sede recebe o aviso por e-mail. O chave mestre aprova ou
 * recusa o pedido (US27: RF27, RN33); sem resposta em 15 dias, o job diário o
 * confirma. Até a decisão, a farmácia continua recebendo o boleto.
 */
@Injectable()
export class CancelamentosService {
  private readonly logger = new Logger(CancelamentosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  async pedir(
    usuarioId: string,
    agora = new Date(),
  ): Promise<PedidoCancelamento> {
    const associadoId = await this.associadoDe(usuarioId);
    const associado = await this.prisma.$transaction(async (tx) => {
      // Trava o associado: dois pedidos ao mesmo tempo viram um só.
      await tx.$queryRaw`SELECT id FROM "Associado" WHERE id = ${associadoId}::uuid FOR UPDATE`;
      const { contribuicaoAtiva, cancelamentos, ...dados } =
        await tx.associado.findUniqueOrThrow({
          where: { id: associadoId },
          select: {
            ...DADOS_AVISO,
            contribuicaoAtiva: true,
            cancelamentos: {
              where: { status: 'PENDENTE' },
              select: { id: true },
            },
          },
        });
      if (!contribuicaoAtiva) {
        throw new ConflictException('A farmácia não recebe o boleto mensal.');
      }
      if (cancelamentos.length > 0) {
        throw new ConflictException(
          'O pedido de cancelamento já foi enviado. A sede vai responder.',
        );
      }
      await tx.solicitacaoCancelamento.create({
        data: { associadoId, solicitadaEm: agora },
      });
      return dados;
    });

    void this.avisarSede(associado, agora);
    return { pedidoEm: agora.toISOString() };
  }

  /**
   * Aprovação ou recusa pelo chave mestre, que fica no log de auditoria
   * (RN26). Devolve o id do associado, para a tela mostrar o perfil de novo.
   */
  async decidir(
    usuarioId: string,
    pedidoId: string,
    { decisao, observacao }: DecidirCancelamentoRequest,
    agora = new Date(),
  ): Promise<string> {
    const { associado, encerrou } = await this.prisma.$transaction(
      async (tx) => {
        // O update trava o pedido: duas decisões ao mesmo tempo viram uma só.
        const { count } = await tx.solicitacaoCancelamento.updateMany({
          where: { id: pedidoId, status: 'PENDENTE' },
          data: {
            status: decisao,
            decididaEm: agora,
            decididaPorId: usuarioId,
            observacaoSede: observacao || null,
          },
        });
        const pedido = await tx.solicitacaoCancelamento.findUnique({
          where: { id: pedidoId },
          select: { associado: { select: DADOS_AVISO } },
        });
        if (!pedido) {
          throw new NotFoundException('Pedido de cancelamento não encontrado.');
        }
        if (count === 0) {
          throw new ConflictException(
            'Este pedido de cancelamento já foi decidido.',
          );
        }
        const encerrada =
          decisao === 'APROVADA' &&
          (await encerrarCobranca(tx, pedido.associado.id, agora));
        await this.auditoria.registrar(tx, {
          usuarioId,
          acao:
            decisao === 'APROVADA'
              ? 'CANCELAMENTO_APROVADO'
              : 'CANCELAMENTO_RECUSADO',
          entidade: 'SolicitacaoCancelamento',
          entidadeId: pedidoId,
          associadoId: pedido.associado.id,
          valorAnterior: {
            status: 'PENDENTE',
            ...(encerrada && { contribuicaoAtiva: true }),
          },
          valorNovo: {
            status: decisao,
            ...(encerrada && { contribuicaoAtiva: false }),
            ...(observacao && { observacao }),
          },
        });
        return { associado: pedido.associado, encerrou: encerrada };
      },
    );

    void this.avisarAssociado(
      associado,
      decisao === 'APROVADA' ? 'CONFIRMADO' : 'RECUSADO',
      encerrou ? agora : null,
    );
    return associado.id;
  }

  /**
   * Job diário: confirma os pedidos que passaram do prazo sem resposta da
   * sede (RN18). Não entra no log de auditoria, que guarda só as ações da
   * sede (RN26): o pedido fica com a situação "confirmado automaticamente".
   */
  async confirmarSemResposta(
    agora = new Date(),
  ): Promise<ResultadoConfirmacao> {
    const vencidos = await this.prisma.solicitacaoCancelamento.findMany({
      where: {
        status: 'PENDENTE',
        solicitadaEm: { lt: prazoVencidoAntesDe(agora) },
      },
      orderBy: { solicitadaEm: 'asc' },
      select: { id: true },
    });

    let confirmados = 0;
    for (const { id } of vencidos) {
      try {
        const resultado = await this.prisma.$transaction(async (tx) => {
          const { count } = await tx.solicitacaoCancelamento.updateMany({
            where: { id, status: 'PENDENTE' },
            data: { status: 'CONFIRMADA_AUTOMATICAMENTE', decididaEm: agora },
          });
          // A sede decidiu enquanto isso.
          if (count === 0) return null;
          const { associado } =
            await tx.solicitacaoCancelamento.findUniqueOrThrow({
              where: { id },
              select: { associado: { select: DADOS_AVISO } },
            });
          return {
            associado,
            encerrou: await encerrarCobranca(tx, associado.id, agora),
          };
        });
        if (!resultado) continue;
        confirmados++;
        await this.avisarAssociado(
          resultado.associado,
          'CONFIRMADO',
          resultado.encerrou ? agora : null,
        );
      } catch (erro) {
        // A próxima execução tenta de novo.
        this.logger.error(
          `O pedido de cancelamento ${id} não foi confirmado.`,
          erro instanceof Error ? erro.stack : undefined,
        );
      }
    }
    return { dia: textoDia(hojeEmMatoGrosso(agora)), confirmados };
  }

  /** Avisa cada usuário chave mestre, que decide o pedido (RN33). */
  private async avisarSede(associado: DadosAviso, solicitadaEm: Date) {
    const web = this.config.get<string>('WEB_URL') ?? 'http://localhost:5173';
    const texto = [
      `${associado.razaoSocial} (CNPJ ${formatarCnpj(associado.cnpj)}) pediu o cancelamento do boleto mensal.`,
      '',
      `A sede pode aprovar ou recusar o pedido até ${formatarDia(respostaAte(solicitadaEm))}. Sem resposta até esse dia, o cancelamento é confirmado no dia seguinte.`,
      '',
      `Para responder, abra o perfil do associado: ${web.replace(/\/$/, '')}/admin/associados/${associado.id}`,
    ].join('\n');
    try {
      const usuarios = await this.prisma.usuario.findMany({
        where: { perfil: 'ADMIN', ativo: true },
        select: { email: true },
      });
      for (const { email } of usuarios) {
        await this.email.send({
          to: email,
          subject: 'Pedido de cancelamento do boleto mensal - Elo Connect',
          text: texto,
        });
      }
    } catch (erro) {
      this.logger.error(
        'Falha ao avisar a sede do pedido de cancelamento.',
        erro instanceof Error ? erro.stack : undefined,
      );
    }
  }

  /**
   * Avisa o associado do resultado do pedido. Com a cobrança encerrada
   * agora, quem estava em dia sabe até quando vai o acesso (RN25).
   */
  private async avisarAssociado(
    associado: DadosAviso,
    desfecho: 'CONFIRMADO' | 'RECUSADO',
    encerradaEm: Date | null,
  ) {
    if (!associado.email) return;
    const comAcesso =
      encerradaEm !== null &&
      podeAcessarRecursoRestrito(
        associado.situacao,
        acessoManualEmVigor(associado.acessoManual, associado.acessoManualAte),
      );
    const resultado =
      desfecho === 'RECUSADO'
        ? [
            'A sede do sindicato recusou o pedido de cancelamento do boleto mensal. A farmácia continua recebendo o boleto todo mês.',
          ]
        : [
            'O cancelamento do boleto mensal foi confirmado. A farmácia não vai mais receber o boleto todo mês.',
            ...(comAcesso
              ? [
                  '',
                  `O seu acesso a benefícios e suporte continua até ${formatarDia(ultimoDiaComAcesso(encerradaEm))}.`,
                ]
              : []),
          ];
    try {
      await this.email.send({
        to: associado.email,
        subject:
          desfecho === 'RECUSADO'
            ? 'O pedido de cancelamento foi recusado - Elo Connect'
            : 'O cancelamento foi confirmado - Elo Connect',
        text: [
          `Olá, ${associado.nomeFantasia ?? associado.razaoSocial}.`,
          '',
          ...resultado,
          '',
          'Se tiver dúvidas, fale com a sede do sindicato.',
        ].join('\n'),
      });
    } catch (erro) {
      this.logger.error(
        'Falha ao avisar o associado do resultado do cancelamento.',
        erro instanceof Error ? erro.stack : undefined,
      );
    }
  }

  private async associadoDe(usuarioId: string): Promise<string> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { associadoId: true },
    });
    if (!usuario?.associadoId) {
      throw new NotFoundException('Associado não encontrado.');
    }
    return usuario.associadoId;
  }
}
