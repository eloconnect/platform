import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  calcularValorAnual,
  competenciaDoNovoValor,
  formatarReais,
  textoCompetencia,
  type PainelValores,
  type ValorContribuicao,
} from '@eloconnect/shared';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { EmailService, type EmailMessage } from '../email/email.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AlterarValorDto } from './dto/alterar-valor.dto.js';

const CAMPOS = {
  id: true,
  valorMensal: true,
  valorAnual: true,
  criadoEm: true,
  alteradoPor: { select: { nome: true } },
} satisfies Prisma.ValorContribuicaoSelect;

/** Quem recebe o aviso de mudança de valor: quem recebe o boleto mensal (RN15). */
const AVISADOS = {
  contribuicaoAtiva: true,
  inativadoEm: null,
  email: { not: null },
} satisfies Prisma.AssociadoWhereInput;

type LinhaValor = Prisma.ValorContribuicaoGetPayload<{
  select: typeof CAMPOS;
}>;

/**
 * Painel de valores da sede (US18, US19, US20: RF18 a RF20). O valor é único
 * para todos (RN01) e cada alteração é um registro novo e imutável (RN16).
 */
@Injectable()
export class ValoresService {
  private readonly logger = new Logger(ValoresService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly email: EmailService,
  ) {}

  /** Valor atual, histórico e quantos associados recebem o aviso. */
  async painel(): Promise<PainelValores> {
    const [linhas, associadosAvisados] = await this.prisma.$transaction([
      this.prisma.valorContribuicao.findMany({
        orderBy: [{ criadoEm: 'desc' }, { id: 'desc' }],
        select: CAMPOS,
      }),
      this.prisma.associado.count({ where: AVISADOS }),
    ]);
    const historico = linhas.map(paraValor);
    return { atual: historico[0] ?? null, historico, associadosAvisados };
  }

  /**
   * Grava o novo valor mensal, com o anual calculado (RF18), e registra no
   * log. O valor vale a partir do boleto do mês seguinte, e quem recebe o
   * boleto mensal é avisado por e-mail na hora (RN15, RF19).
   */
  async alterar(
    usuarioId: string,
    dados: AlterarValorDto,
  ): Promise<PainelValores> {
    // "0130.00" e "130.00" são o mesmo valor.
    const valorMensal = Number(dados.valorMensal).toFixed(2);
    if (Number(valorMensal) <= 0) {
      throw new BadRequestException({
        message: 'O valor precisa ser maior que zero.',
        campo: 'valorMensal',
      });
    }
    const valorAnual = calcularValorAnual(valorMensal);

    const { mensalAnterior, novo } = await this.prisma.$transaction(
      async (tx) => {
        const ultimo = await tx.valorContribuicao.findFirst({
          orderBy: [{ criadoEm: 'desc' }, { id: 'desc' }],
          select: CAMPOS,
        });
        const anterior = ultimo ? paraValor(ultimo) : null;
        if (anterior?.valorMensal === valorMensal) {
          throw new BadRequestException({
            message: 'Este já é o valor atual.',
            campo: 'valorMensal',
          });
        }
        const criado = await tx.valorContribuicao.create({
          data: { valorMensal, valorAnual, alteradoPorId: usuarioId },
          select: CAMPOS,
        });
        await this.auditoria.registrar(tx, {
          usuarioId,
          acao: 'VALOR_ALTERADO',
          entidade: 'ValorContribuicao',
          entidadeId: criado.id,
          ...(anterior
            ? {
                valorAnterior: {
                  valorMensal: anterior.valorMensal,
                  valorAnual: anterior.valorAnual,
                },
              }
            : {}),
          valorNovo: { valorMensal, valorAnual },
        });
        return {
          mensalAnterior: anterior?.valorMensal ?? null,
          novo: paraValor(criado),
        };
      },
    );

    await this.avisarAssociados(mensalAnterior, novo);
    return this.painel();
  }

  /**
   * Monta um e-mail por associado e envia em segundo plano: o valor já foi
   * gravado, e uma falha no envio não pode desfazê-lo.
   * TODO(P12): com o provedor de e-mail de produção, enviar com o `waitUntil`
   * da Vercel ou numa fila, porque são cerca de 150 e-mails.
   */
  private async avisarAssociados(
    mensalAnterior: string | null,
    novo: ValorContribuicao,
  ) {
    const associados = await this.prisma.associado.findMany({
      where: AVISADOS,
      select: { email: true, razaoSocial: true, nomeFantasia: true },
    });
    const mesInicial = textoCompetencia(
      competenciaDoNovoValor(new Date(novo.alteradoEm)),
    );
    const mensagens = associados.flatMap(
      ({ email, razaoSocial, nomeFantasia }): EmailMessage[] =>
        email
          ? [
              {
                to: email,
                subject: 'O valor da contribuição vai mudar - Elo Connect',
                text: textoAviso(
                  nomeFantasia ?? razaoSocial,
                  mensalAnterior,
                  novo,
                  mesInicial,
                ),
              },
            ]
          : [],
    );
    void this.enviarUmPorUm(mensagens);
  }

  private async enviarUmPorUm(mensagens: EmailMessage[]) {
    for (const mensagem of mensagens) {
      try {
        await this.email.send(mensagem);
      } catch (error: unknown) {
        this.logger.error(
          'Falha ao enviar o aviso de mudança de valor.',
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
  }
}

function paraValor(linha: LinhaValor): ValorContribuicao {
  return {
    id: linha.id,
    valorMensal: linha.valorMensal.toFixed(2),
    valorAnual: linha.valorAnual.toFixed(2),
    alteradoEm: linha.criadoEm.toISOString(),
    alteradoPor: linha.alteradoPor,
  };
}

function textoAviso(
  nome: string,
  mensalAnterior: string | null,
  novo: ValorContribuicao,
  mesInicial: string,
): string {
  return [
    `Olá, ${nome}.`,
    '',
    'O valor da contribuição mensal ao sindicato vai mudar.',
    '',
    ...(mensalAnterior
      ? [`Valor anterior: ${formatarReais(mensalAnterior)} por mês.`]
      : []),
    `Novo valor: ${formatarReais(novo.valorMensal)} por mês, a partir do boleto de ${mesInicial}.`,
    '',
    'Os boletos que você já recebeu não mudam.',
  ].join('\n');
}
