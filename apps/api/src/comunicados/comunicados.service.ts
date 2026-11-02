import {
  formatarReais,
  GRUPOS_BENEFICIO,
  TEXTO_GRUPO_BENEFICIO,
  type Comunicado,
  type CriarComunicadoRequest,
  type GrupoBeneficio,
  type PainelComunicados,
} from '@eloconnect/shared';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import {
  hojeEmMatoGrosso,
  inicioDoDiaEmMatoGrosso,
  textoDia,
} from '../cobranca/valor-do-mes.js';
import { EmailService } from '../email/email.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

const UM_DIA = 24 * 60 * 60 * 1000;

/**
 * E-mails do comunicado por dia, quando a hospedagem não diz outro número:
 * metade dos 300 por dia do plano grátis do Brevo, para sobrar espaço para
 * os e-mails urgentes (senha, boletos e lembretes).
 * TODO(P12): o provedor e o limite de produção dependem do cliente.
 */
export const LIMITE_DIARIO_PADRAO = 150;

/**
 * Quem recebe: todos os associados do cadastro com e-mail, pagando ou não,
 * menos os inativados pela sede (decisão do grupo, 02/11/2026).
 * TODO(P02): a base completa vem do arquivo da JUCEMAT, quando ele chegar.
 * TODO(P13): o que a inativação muda.
 */
const DESTINATARIOS = {
  email: { not: null },
  inativadoEm: null,
} satisfies Prisma.AssociadoWhereInput;

const CAMPOS = {
  id: true,
  assunto: true,
  mensagem: true,
  criadoEm: true,
  concluidoEm: true,
  criadoPor: { select: { nome: true } },
  _count: { select: { envios: true } },
} satisfies Prisma.ComunicadoSelect;

type LinhaComunicado = Prisma.ComunicadoGetPayload<{ select: typeof CAMPOS }>;

/** Resultado do job diário do envio. */
export interface ResultadoEnvio {
  /** Dia da execução em Mato Grosso ("AAAA-MM-DD"). */
  dia: string;
  /** E-mails enviados nesta execução. */
  enviados: number;
  /** E-mails que ficam para os próximos dias. */
  pendentes: number;
}

/**
 * Mensagem do comunicado: o texto da sede e, no fim, o valor da contribuição
 * e os benefícios cadastrados, que a cobrança formal precisa informar (RN19).
 * TODO(P26): o cliente ainda não disse se já tem um texto para o comunicado.
 */
export function montarMensagem(
  texto: string,
  valorMensal: string,
  beneficios: { titulo: string; grupo: GrupoBeneficio }[],
): string {
  const linhas = [
    texto,
    '',
    `Valor da contribuição: ${formatarReais(valorMensal)} por mês.`,
  ];
  if (beneficios.length > 0) {
    linhas.push('', 'Benefícios de quem contribui:');
    for (const grupo of GRUPOS_BENEFICIO) {
      const doGrupo = beneficios.filter((b) => b.grupo === grupo);
      if (doGrupo.length === 0) continue;
      linhas.push('', TEXTO_GRUPO_BENEFICIO[grupo]);
      linhas.push(...doGrupo.map((b) => `- ${b.titulo}`));
    }
  }
  return linhas.join('\n');
}

/**
 * Cobrança formal (US29: RF29, RN19): o chave mestre escreve o comunicado, e
 * ele vai por e-mail, sem boleto, a todos os associados do cadastro. Como são
 * cerca de 2.000, o envio é escalonado: o job diário manda uma parte por
 * dia, dentro do limite do provedor (RNF09), e a tela mostra quantos saíram.
 */
@Injectable()
export class ComunicadosService {
  private readonly logger = new Logger(ComunicadosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  /** E-mails do comunicado por dia, da variável da hospedagem. */
  limiteDiario(): number {
    const valor = Number(this.config.get<string>('LIMITE_DIARIO_COMUNICADO'));
    return Number.isInteger(valor) && valor > 0 ? valor : LIMITE_DIARIO_PADRAO;
  }

  async painel(): Promise<PainelComunicados> {
    const [destinatarios, linhas, enviados] = await this.prisma.$transaction([
      this.prisma.associado.count({ where: DESTINATARIOS }),
      this.prisma.comunicado.findMany({
        orderBy: [{ criadoEm: 'desc' }, { id: 'desc' }],
        select: CAMPOS,
      }),
      this.prisma.envioComunicado.groupBy({
        by: ['comunicadoId'],
        where: { enviadoEm: { not: null } },
        orderBy: { comunicadoId: 'asc' },
        _count: { _all: true },
      }),
    ]);
    const porComunicado = new Map(
      enviados.map(({ comunicadoId, _count: { _all: quantos } }) => [
        comunicadoId,
        quantos,
      ]),
    );
    return {
      destinatarios,
      limiteDiario: this.limiteDiario(),
      comunicados: linhas.map((linha) =>
        paraComunicado(linha, porComunicado.get(linha.id) ?? 0),
      ),
    };
  }

  /**
   * Grava o comunicado com um envio por associado, que o job diário manda
   * aos poucos. Um comunicado por vez: o próximo espera o anterior terminar.
   */
  async criar(
    usuarioId: string,
    { assunto, texto }: CriarComunicadoRequest,
  ): Promise<Comunicado> {
    const linha = await this.prisma.$transaction(
      async (tx) => {
        // Trava a criação: dois comunicados ao mesmo tempo viram um só.
        await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext('comunicado'))`;
        if (await tx.comunicado.findFirst({ where: { concluidoEm: null } })) {
          throw new ConflictException(
            'Um comunicado ainda está sendo enviado. Espere o envio terminar para mandar outro.',
          );
        }
        // O valor atual é o último que a sede cadastrou, como no painel de
        // valores.
        const valor = await tx.valorContribuicao.findFirst({
          orderBy: [{ criadoEm: 'desc' }, { id: 'desc' }],
          select: { valorMensal: true },
        });
        if (!valor) {
          throw new BadRequestException(
            'A sede ainda não cadastrou o valor da contribuição.',
          );
        }
        const destinatarios = await tx.associado.findMany({
          where: DESTINATARIOS,
          orderBy: { id: 'asc' },
          select: { id: true, email: true },
        });
        if (destinatarios.length === 0) {
          throw new BadRequestException(
            'Nenhum associado do cadastro tem e-mail.',
          );
        }
        const beneficios = await tx.beneficio.findMany({
          where: { ativo: true },
          orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }, { id: 'asc' }],
          select: { titulo: true, grupo: true },
        });

        const { id } = await tx.comunicado.create({
          data: {
            assunto,
            mensagem: montarMensagem(
              texto,
              valor.valorMensal.toFixed(2),
              beneficios,
            ),
            criadoPorId: usuarioId,
          },
        });
        await tx.envioComunicado.createMany({
          data: destinatarios.map((associado) => ({
            comunicadoId: id,
            associadoId: associado.id,
            email: associado.email ?? '',
          })),
        });
        await this.auditoria.registrar(tx, {
          usuarioId,
          acao: 'COMUNICADO_CRIADO',
          entidade: 'Comunicado',
          entidadeId: id,
          valorNovo: { assunto, destinatarios: destinatarios.length },
        });
        return tx.comunicado.findUniqueOrThrow({
          where: { id },
          select: CAMPOS,
        });
      },
      { timeout: 30_000 },
    );
    return paraComunicado(linha, 0);
  }

  /**
   * Job diário: manda os e-mails pendentes até o limite do dia, contando os
   * que já saíram hoje, no horário de Mato Grosso. Se o provedor recusa um
   * e-mail, por exemplo por ter chegado ao limite dele, o job para, e a
   * próxima execução continua de onde parou.
   */
  async enviarDoDia(agora = new Date()): Promise<ResultadoEnvio> {
    const inicio = inicioDoDiaEmMatoGrosso(hojeEmMatoGrosso(agora));
    const jaEnviados = await this.prisma.envioComunicado.count({
      where: {
        enviadoEm: { gte: inicio, lt: new Date(inicio.getTime() + UM_DIA) },
      },
    });
    const pendentes = await this.prisma.envioComunicado.findMany({
      where: { enviadoEm: null },
      orderBy: [{ comunicado: { criadoEm: 'asc' } }, { id: 'asc' }],
      take: Math.max(0, this.limiteDiario() - jaEnviados),
      select: {
        id: true,
        email: true,
        comunicado: { select: { assunto: true, mensagem: true } },
        associado: { select: { razaoSocial: true, nomeFantasia: true } },
      },
    });

    let enviados = 0;
    for (const envio of pendentes) {
      // Marca antes de mandar: duas execuções juntas não mandam em dobro.
      const { count } = await this.prisma.envioComunicado.updateMany({
        where: { id: envio.id, enviadoEm: null },
        data: { enviadoEm: agora },
      });
      if (count === 0) continue;
      try {
        await this.email.send({
          to: envio.email,
          subject: envio.comunicado.assunto,
          text: `Olá, ${envio.associado.nomeFantasia ?? envio.associado.razaoSocial}.\n\n${envio.comunicado.mensagem}`,
        });
        enviados++;
      } catch (erro) {
        await this.prisma.envioComunicado.update({
          where: { id: envio.id },
          data: { enviadoEm: null },
        });
        this.logger.error(
          'O comunicado parou de sair; a próxima execução continua.',
          erro instanceof Error ? erro.stack : undefined,
        );
        break;
      }
    }

    // O comunicado sem e-mail pendente terminou.
    await this.prisma.comunicado.updateMany({
      where: { concluidoEm: null, envios: { none: { enviadoEm: null } } },
      data: { concluidoEm: agora },
    });
    return {
      dia: textoDia(hojeEmMatoGrosso(agora)),
      enviados,
      pendentes: await this.prisma.envioComunicado.count({
        where: { enviadoEm: null },
      }),
    };
  }
}

function paraComunicado(
  { _count: contagem, ...linha }: LinhaComunicado,
  enviados: number,
): Comunicado {
  return {
    id: linha.id,
    assunto: linha.assunto,
    mensagem: linha.mensagem,
    criadoEm: linha.criadoEm.toISOString(),
    criadoPor: linha.criadoPor,
    total: contagem.envios,
    enviados,
    concluidoEm: linha.concluidoEm?.toISOString() ?? null,
  };
}
