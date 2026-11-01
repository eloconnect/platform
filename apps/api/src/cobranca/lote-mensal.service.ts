import { FUSO_SEDE_HORAS } from '@eloconnect/shared';
import { Injectable, Logger } from '@nestjs/common';
import type { LoteMensal, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { primeiroDiaUtil } from './dia-util.js';
import { EmailBoletoService } from './email-boleto.service.js';
import { GatewayPagamento, validoAte } from './gateway-pagamento.js';
import { TransacoesService } from './transacoes.service.js';
import { valorDoMes } from './valor-do-mes.js';

const UM_DIA = 24 * 60 * 60 * 1000;
const UMA_HORA = 60 * 60 * 1000;

/** O que uma execução fez, para o log da hospedagem. */
export type ResultadoLote =
  | { situacao: 'ANTES_DO_DIA_UTIL'; competencia: string }
  | {
      situacao: 'ENVIADO' | 'INCOMPLETO';
      competencia: string;
      /** Boletos emitidos nesta execução. */
      emitidos: number;
      /** Boletos que o banco não emitiu; a próxima execução tenta de novo. */
      pendentes: number;
      /** E-mails com o boleto enviados nesta execução. */
      emails: number;
      /** E-mails que não saíram; a próxima execução tenta de novo. */
      emailsPendentes: number;
    };

/**
 * Boletos emitidos do lote que ainda não foram por e-mail. Quem não tem
 * e-mail no cadastro fica de fora.
 */
function semEmail(loteId: string) {
  return {
    loteId,
    status: 'EM_ABERTO',
    emailEnviadoEm: null,
    associado: { email: { not: null } },
  } satisfies Prisma.BoletoWhereInput;
}

/**
 * Lote mensal de boletos (RF10): gerado e enviado sozinho no primeiro dia útil
 * do mês, sem revisão da sede (RN04), só para quem tem contribuição ativa
 * (RN05).
 *
 * O cron chama `executar` todo dia, e cada execução continua de onde a
 * anterior parou: cria o lote e os boletos em RASCUNHO, emite no banco os que
 * ainda estão em RASCUNHO, manda o e-mail de cada boleto emitido que ainda
 * não foi (RF12) e marca o lote como ENVIADO quando não sobra nada. Assim,
 * uma execução perdida ou que caiu no meio é recuperada no dia seguinte, e
 * uma execução repetida não gera nada de novo. Se a execução cai entre o
 * envio de um e-mail e o registro dele, esse associado recebe o e-mail duas
 * vezes.
 */
@Injectable()
export class LoteMensalService {
  private readonly logger = new Logger(LoteMensalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly transacoes: TransacoesService,
    private readonly gateway: GatewayPagamento,
    private readonly emailBoleto: EmailBoletoService,
  ) {}

  async executar(agora = new Date()): Promise<ResultadoLote> {
    // Data de hoje no horário de Mato Grosso.
    const hoje = new Date(agora.getTime() + FUSO_SEDE_HORAS * UMA_HORA);
    const ano = hoje.getUTCFullYear();
    const mes = hoje.getUTCMonth() + 1;
    const competencia = new Date(Date.UTC(ano, mes - 1, 1));
    const texto = competencia.toISOString().slice(0, 7);
    if (hoje.getUTCDate() < primeiroDiaUtil({ ano, mes })) {
      return { situacao: 'ANTES_DO_DIA_UTIL', competencia: texto };
    }

    const lote =
      (await this.prisma.loteMensal.findUnique({ where: { competencia } })) ??
      (await this.gerar(competencia));
    if (lote.status === 'ENVIADO') {
      return {
        situacao: 'ENVIADO',
        competencia: texto,
        emitidos: 0,
        pendentes: 0,
        emails: 0,
        emailsPendentes: 0,
      };
    }

    const rascunhos = await this.prisma.boleto.findMany({
      where: { loteId: lote.id, status: 'RASCUNHO' },
      select: { id: true },
      orderBy: { id: 'asc' },
    });
    let emitidos = 0;
    for (const { id } of rascunhos) {
      try {
        if (await this.emitir(id)) emitidos++;
      } catch (erro) {
        this.logger.error(
          `O banco não emitiu o boleto ${id}.`,
          erro instanceof Error ? erro.stack : undefined,
        );
      }
    }

    // Um e-mail de cada vez, aguardando cada envio: na Vercel, o que não é
    // aguardado pode ser cortado quando a resposta sai.
    const paraEnviar = await this.prisma.boleto.findMany({
      where: semEmail(lote.id),
      select: { id: true },
      orderBy: { id: 'asc' },
    });
    let emails = 0;
    for (const { id } of paraEnviar) {
      try {
        await this.emailBoleto.enviar(id);
        emails++;
      } catch (erro) {
        this.logger.error(
          `O e-mail do boleto ${id} não saiu.`,
          erro instanceof Error ? erro.stack : undefined,
        );
      }
    }

    const pendentes = await this.prisma.boleto.count({
      where: { loteId: lote.id, status: 'RASCUNHO' },
    });
    const emailsPendentes = await this.prisma.boleto.count({
      where: semEmail(lote.id),
    });
    if (pendentes === 0 && emailsPendentes === 0) {
      await this.prisma.loteMensal.updateMany({
        where: { id: lote.id, status: 'RASCUNHO' },
        data: { status: 'ENVIADO', enviadoEm: new Date() },
      });
    }
    return {
      situacao:
        pendentes === 0 && emailsPendentes === 0 ? 'ENVIADO' : 'INCOMPLETO',
      competencia: texto,
      emitidos,
      pendentes,
      emails,
      emailsPendentes,
    };
  }

  /**
   * Cria o lote do mês com um boleto em RASCUNHO para cada associado. Se duas
   * execuções chegam juntas, a segunda esbarra na competência única do lote e
   * não cria nada.
   */
  private gerar(competencia: Date): Promise<LoteMensal> {
    return this.prisma.$transaction(
      async (tx) => {
        const valor = await valorDoMes(tx, competencia);
        if (!valor) {
          throw new Error(
            'A sede ainda não cadastrou o valor da contribuição.',
          );
        }
        const associados = await tx.associado.findMany({
          where: {
            contribuicaoAtiva: true,
            // TODO(P13): o que a inativação muda na cobrança recorrente. Até
            // a resposta, quem a sede inativou fica fora do lote.
            inativadoEm: null,
            // Quem já tem o boleto do mês, como o da adesão (RN23), não
            // recebe outro.
            boletos: {
              none: { competencia, status: { not: 'CANCELADO' } },
            },
          },
          select: {
            id: true,
            // Valor que a sede mudou só para o boleto deste mês (RN04).
            edicoesBoleto: { where: { competencia }, select: { valor: true } },
          },
        });

        const lote = await tx.loteMensal.create({ data: { competencia } });
        for (const { id, edicoesBoleto } of associados) {
          await this.transacoes.criarBoleto(tx, {
            associadoId: id,
            loteId: lote.id,
            tipo: 'MENSAL',
            competencia,
            valor: edicoesBoleto[0]?.valor ?? valor,
            // Dia 10 (RN02).
            vencimento: new Date(competencia.getTime() + 9 * UM_DIA),
          });
        }
        return lote;
      },
      // Cerca de 150 boletos, com o histórico de cada um.
      { timeout: 30_000 },
    );
  }

  /**
   * Emite um boleto no banco e guarda o que o banco devolveu. Devolve false
   * se outra execução já emitiu o boleto.
   */
  private emitir(id: string): Promise<boolean> {
    return this.prisma.$transaction(
      async (tx) => {
        // O update trava o boleto: se duas execuções chegam juntas, a segunda
        // espera a primeira terminar e, como o boleto já saiu do RASCUNHO,
        // não emite de novo.
        const { count } = await tx.boleto.updateMany({
          where: { id, status: 'RASCUNHO' },
          data: { atualizadoEm: new Date() },
        });
        if (count === 0) return false;

        const boleto = await tx.boleto.findUniqueOrThrow({
          where: { id },
          include: { associado: { select: { cnpj: true, razaoSocial: true } } },
        });
        const emitido = await this.gateway.emitir({
          boletoId: id,
          valor: boleto.valor,
          vencimento: boleto.vencimento,
          validoAte: validoAte(boleto.vencimento),
          pagador: {
            cnpj: boleto.associado.cnpj,
            nome: boleto.associado.razaoSocial,
          },
        });
        // TODO(#40): se a gravação falhar depois da emissão, a próxima
        // execução emite o boleto de novo. O estudo diz se o Sicredi recusa
        // um segundo boleto com o mesmo id.
        await this.transacoes.alterarBoleto(
          tx,
          id,
          {
            status: 'EM_ABERTO',
            sicrediNossoNumero: emitido.nossoNumero,
            linhaDigitavel: emitido.linhaDigitavel,
            pixCopiaECola: emitido.pixCopiaECola,
            emitidoEm: new Date(),
          },
          { evento: 'EMITIDO' },
        );
        return true;
      },
      { timeout: 30_000 },
    );
  }
}
