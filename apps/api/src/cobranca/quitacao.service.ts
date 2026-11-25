import {
  formatarCnpj,
  type DecidirQuitacaoRequest,
  type MesEmAberto,
  type PedidoQuitacaoSede,
  type SituacaoQuitacao,
} from '@eloconnect/shared';
import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { EmailService } from '../email/email.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DIAS_VENCIMENTO_ADESAO } from './adesao.service.js';
import { EmailBoletoService } from './email-boleto.service.js';
import { emitirBoleto } from './emissao.js';
import { GatewayPagamento } from './gateway-pagamento.js';
import { TransacoesService } from './transacoes.service.js';
import {
  competenciaDaData,
  dataDaCompetencia,
  hojeEmMatoGrosso,
} from './valor-do-mes.js';

type Tx = Prisma.TransactionClient;

const UM_DIA = 24 * 60 * 60 * 1000;

/**
 * Meses expirados que ainda não foram pagos: os boletos expirados, menos os
 * que um boleto dos meses em aberto pago juntou (RN30). O boleto dos meses em
 * aberto que expirou não entra, porque os meses dele continuam aqui.
 */
export function mesesExpiradosSemPagamento(
  associadoId: string,
): Prisma.BoletoWhereInput {
  return {
    associadoId,
    status: 'EXPIRADO',
    tipo: { not: 'QUITACAO' },
    OR: [{ quitadoPorId: null }, { quitadoPor: { status: { not: 'PAGO' } } }],
  };
}

/**
 * Meses que entram num boleto dos meses em aberto novo: os expirados sem
 * pagamento e sem um boleto dos meses em aberto que ainda pode ser pago.
 */
function mesesParaJuntar(associadoId: string): Prisma.BoletoWhereInput {
  return {
    associadoId,
    status: 'EXPIRADO',
    tipo: { not: 'QUITACAO' },
    OR: [
      { quitadoPorId: null },
      { quitadoPor: { status: { in: ['EXPIRADO', 'CANCELADO'] } } },
    ],
  };
}

/**
 * Boleto único dos meses em aberto (US34: RF37, RN30). Para voltar a ficar em
 * dia, o associado paga todos os meses expirados, sem juros, num boleto só.
 * Ele pede pelo site, e cada usuário chave mestre recebe um e-mail. O chave
 * mestre aprova ou recusa no perfil do associado, com o log de auditoria
 * (RN26, RN33). Aprovado, o boleto sai na hora, vence 10 dias depois, como o
 * da adesão, e vai por e-mail. Pago, os meses que ele junta contam como pagos,
 * e o associado volta a ficar em dia (RN10).
 */
@Injectable()
export class QuitacaoService {
  private readonly logger = new Logger(QuitacaoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly transacoes: TransacoesService,
    private readonly gateway: GatewayPagamento,
    private readonly emailBoleto: EmailBoletoService,
    private readonly auditoria: AuditoriaService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  async situacao(usuarioId: string): Promise<SituacaoQuitacao> {
    return this.situacaoDe(this.prisma, await this.associadoDe(usuarioId));
  }

  async pedir(usuarioId: string, agora = new Date()) {
    const associadoId = await this.associadoDe(usuarioId);
    const { situacao, associado } = await this.prisma.$transaction(
      async (tx) => {
        // Trava o associado: dois pedidos ao mesmo tempo viram um só.
        await tx.$queryRaw`SELECT id FROM "Associado" WHERE id = ${associadoId}::uuid FOR UPDATE`;
        const antes = await this.situacaoDe(tx, associadoId);
        if (antes.meses.length === 0) {
          throw new ConflictException('A farmácia não tem meses em aberto.');
        }
        if (antes.boletoEmAberto) {
          throw new ConflictException(
            'O boleto dos meses em aberto já saiu. Ele está em "Meus boletos".',
          );
        }
        if (antes.pedido?.status === 'PENDENTE') {
          throw new ConflictException(
            'O pedido já foi enviado. A sede vai responder.',
          );
        }
        await tx.pedidoQuitacao.create({
          data: { associadoId, solicitadoEm: agora },
        });
        return {
          situacao: await this.situacaoDe(tx, associadoId),
          associado: await tx.associado.findUniqueOrThrow({
            where: { id: associadoId },
            select: { id: true, cnpj: true, razaoSocial: true },
          }),
        };
      },
    );
    void this.avisarSede(associado, situacao.total);
    return situacao;
  }

  /** Pedidos que esperam a sede, do mais antigo ao mais novo. */
  async pendentes(associadoId?: string): Promise<PedidoQuitacaoSede[]> {
    const pedidos = await this.prisma.pedidoQuitacao.findMany({
      where: { status: 'PENDENTE', ...(associadoId && { associadoId }) },
      orderBy: { solicitadoEm: 'asc' },
      select: {
        id: true,
        associadoId: true,
        solicitadoEm: true,
        associado: { select: { razaoSocial: true } },
      },
    });
    return Promise.all(
      pedidos.map(async (pedido) => {
        const meses = await this.meses(this.prisma, pedido.associadoId);
        return {
          id: pedido.id,
          associadoId: pedido.associadoId,
          razaoSocial: pedido.associado.razaoSocial,
          solicitadoEm: pedido.solicitadoEm.toISOString(),
          meses: meses.map(({ competencia, valor }) => ({
            competencia: competenciaDaData(competencia),
            valor: valor.toFixed(2),
          })),
          total: somar(meses).toFixed(2),
        };
      }),
    );
  }

  /**
   * Aprovação ou recusa pelo chave mestre. Aprovado, o boleto sai na hora,
   * já emitido no banco, e vai por e-mail.
   */
  async decidir(
    usuarioId: string,
    pedidoId: string,
    { decisao, observacao }: DecidirQuitacaoRequest,
    agora = new Date(),
  ): Promise<{ boletoId: string | null }> {
    const { boletoId, associado } = await this.prisma.$transaction(
      async (tx) => {
        // O update trava o pedido: duas decisões ao mesmo tempo viram uma só.
        const { count } = await tx.pedidoQuitacao.updateMany({
          where: { id: pedidoId, status: 'PENDENTE' },
          data: {
            status: decisao,
            decididoEm: agora,
            decididoPorId: usuarioId,
            observacaoSede: observacao || null,
          },
        });
        const pedido = await tx.pedidoQuitacao.findUnique({
          where: { id: pedidoId },
          select: {
            associado: {
              select: {
                id: true,
                email: true,
                razaoSocial: true,
                nomeFantasia: true,
              },
            },
          },
        });
        if (!pedido) {
          throw new NotFoundException('Pedido não encontrado.');
        }
        if (count === 0) {
          throw new ConflictException('Este pedido já foi decidido.');
        }
        const associadoId = pedido.associado.id;

        let novoBoleto: { id: string; valor: Prisma.Decimal } | null = null;
        let meses: { id: string; competencia: Date }[] = [];
        if (decisao === 'APROVADO') {
          const expirados = await this.meses(tx, associadoId);
          if (expirados.length === 0) {
            throw new ConflictException('A farmácia não tem meses em aberto.');
          }
          meses = expirados;
          const boleto = await this.transacoes.criarBoleto(
            tx,
            {
              associadoId,
              tipo: 'QUITACAO',
              competencia: dataDaCompetencia(
                competenciaDaData(hojeEmMatoGrosso(agora)),
              ),
              valor: somar(expirados),
              vencimento: new Date(
                hojeEmMatoGrosso(agora).getTime() +
                  DIAS_VENCIMENTO_ADESAO * UM_DIA,
              ),
            },
            usuarioId,
          );
          await tx.boleto.updateMany({
            where: { id: { in: expirados.map(({ id }) => id) } },
            data: { quitadoPorId: boleto.id },
          });
          await tx.pedidoQuitacao.update({
            where: { id: pedidoId },
            data: { boletoId: boleto.id },
          });
          // Se o banco falha, a decisão toda é desfeita, e a sede tenta de novo.
          await emitirBoleto(tx, this.gateway, this.transacoes, boleto.id);
          novoBoleto = boleto;
        }

        await this.auditoria.registrar(tx, {
          usuarioId,
          acao:
            decisao === 'APROVADO' ? 'QUITACAO_APROVADA' : 'QUITACAO_RECUSADA',
          entidade: 'PedidoQuitacao',
          entidadeId: pedidoId,
          associadoId,
          valorAnterior: { status: 'PENDENTE' },
          valorNovo: {
            status: decisao,
            ...(novoBoleto && {
              valor: novoBoleto.valor.toFixed(2),
              meses: meses
                .map(({ competencia }) => {
                  const { ano, mes } = competenciaDaData(competencia);
                  return `${ano}-${String(mes).padStart(2, '0')}`;
                })
                .join(', '),
            }),
            ...(observacao && { observacao }),
          },
        });
        return {
          boletoId: novoBoleto?.id ?? null,
          associado: pedido.associado,
        };
      },
      { timeout: 30_000 },
    );

    if (boletoId) {
      try {
        await this.emailBoleto.enviar(boletoId);
      } catch (erro) {
        // O boleto já está em "Meus boletos".
        this.logger.error(
          `O e-mail do boleto ${boletoId}, dos meses em aberto, não saiu.`,
          erro instanceof Error ? erro.stack : undefined,
        );
      }
    } else {
      void this.avisarRecusa(associado);
    }
    return { boletoId };
  }

  private async situacaoDe(
    tx: Tx,
    associadoId: string,
  ): Promise<SituacaoQuitacao> {
    const [meses, pedido, boletoEmAberto] = await Promise.all([
      this.meses(tx, associadoId),
      tx.pedidoQuitacao.findFirst({
        where: { associadoId },
        orderBy: { solicitadoEm: 'desc' },
        select: { status: true, solicitadoEm: true, decididoEm: true },
      }),
      tx.boleto.count({
        where: { associadoId, tipo: 'QUITACAO', status: 'EM_ABERTO' },
      }),
    ]);
    return {
      meses: meses.map(({ competencia, valor }) => ({
        competencia: competenciaDaData(competencia),
        valor: valor.toFixed(2),
      })) satisfies MesEmAberto[],
      total: somar(meses).toFixed(2),
      pedido: pedido && {
        status: pedido.status,
        solicitadoEm: pedido.solicitadoEm.toISOString(),
        decididoEm: pedido.decididoEm?.toISOString() ?? null,
      },
      boletoEmAberto: boletoEmAberto > 0,
    };
  }

  private meses(tx: Tx, associadoId: string) {
    return tx.boleto.findMany({
      where: mesesParaJuntar(associadoId),
      orderBy: [{ competencia: 'asc' }, { id: 'asc' }],
      select: { id: true, competencia: true, valor: true },
    });
  }

  /** Avisa cada usuário chave mestre, que decide o pedido (RN33). */
  private async avisarSede(
    associado: { id: string; cnpj: string; razaoSocial: string },
    total: string,
  ) {
    const web = this.config.get<string>('WEB_URL') ?? 'http://localhost:5173';
    const texto = [
      `${associado.razaoSocial} (CNPJ ${formatarCnpj(associado.cnpj)}) pediu o boleto único dos meses em aberto, de R$ ${total.replace('.', ',')}.`,
      '',
      `Para aprovar ou recusar, abra o perfil do associado: ${web.replace(/\/$/, '')}/admin/associados/${associado.id}`,
    ].join('\n');
    try {
      const usuarios = await this.prisma.usuario.findMany({
        where: { perfil: 'ADMIN', ativo: true },
        select: { email: true },
      });
      for (const { email } of usuarios) {
        await this.email.send({
          to: email,
          subject: 'Pedido do boleto dos meses em aberto - Elo Connect',
          text: texto,
        });
      }
    } catch (erro) {
      this.logger.error(
        'Falha ao avisar a sede do pedido dos meses em aberto.',
        erro instanceof Error ? erro.stack : undefined,
      );
    }
  }

  private async avisarRecusa(associado: {
    email: string | null;
    razaoSocial: string;
    nomeFantasia: string | null;
  }) {
    if (!associado.email) return;
    try {
      await this.email.send({
        to: associado.email,
        subject:
          'O pedido do boleto dos meses em aberto foi recusado - Elo Connect',
        text: [
          `Olá, ${associado.nomeFantasia ?? associado.razaoSocial}.`,
          '',
          'A sede do sindicato recusou o pedido do boleto único dos meses em aberto.',
          '',
          'Para saber mais, fale com a sede do sindicato.',
        ].join('\n'),
      });
    } catch (erro) {
      this.logger.error(
        'Falha ao avisar o associado da recusa do pedido dos meses em aberto.',
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

function somar(meses: { valor: Prisma.Decimal }[]): Prisma.Decimal {
  return meses.reduce(
    (total, { valor }) => total.add(valor),
    new Prisma.Decimal(0),
  );
}
