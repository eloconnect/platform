import { FUSO_SEDE_HORAS } from '@eloconnect/shared';
import { Injectable, Logger } from '@nestjs/common';
import type { LoteMensal } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { primeiroDiaUtil } from './dia-util.js';
import { GatewayPagamento } from './gateway-pagamento.js';
import { TransacoesService } from './transacoes.service.js';

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
    };

/**
 * Lote mensal de boletos (RF10): gerado e enviado sozinho no primeiro dia útil
 * do mês, sem revisão da sede (RN04), só para quem tem contribuição ativa
 * (RN05).
 *
 * O cron chama `executar` todo dia, e cada execução continua de onde a
 * anterior parou: cria o lote e os boletos em RASCUNHO, emite no banco os que
 * ainda estão em RASCUNHO e marca o lote como ENVIADO quando não sobra nenhum.
 * Assim, uma execução perdida ou que caiu no meio é recuperada no dia
 * seguinte, e uma execução repetida não gera nada de novo.
 */
@Injectable()
export class LoteMensalService {
  private readonly logger = new Logger(LoteMensalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly transacoes: TransacoesService,
    private readonly gateway: GatewayPagamento,
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
    // TODO(#46): mandar a cada associado o e-mail com o boleto e o Pix.

    const pendentes = await this.prisma.boleto.count({
      where: { loteId: lote.id, status: 'RASCUNHO' },
    });
    if (pendentes === 0) {
      await this.prisma.loteMensal.updateMany({
        where: { id: lote.id, status: 'RASCUNHO' },
        data: { status: 'ENVIADO', enviadoEm: new Date() },
      });
    }
    return {
      situacao: pendentes === 0 ? 'ENVIADO' : 'INCOMPLETO',
      competencia: texto,
      emitidos,
      pendentes,
    };
  }

  /**
   * Cria o lote do mês com um boleto em RASCUNHO para cada associado. Se duas
   * execuções chegam juntas, a segunda esbarra na competência única do lote e
   * não cria nada.
   */
  private gerar(competencia: Date): Promise<LoteMensal> {
    // Meia-noite do dia 1 em Mato Grosso.
    const inicioDoMes = new Date(
      competencia.getTime() - FUSO_SEDE_HORAS * UMA_HORA,
    );
    return this.prisma.$transaction(
      async (tx) => {
        // O valor alterado vale a partir do boleto do mês seguinte (RN15).
        const valor = await tx.valorContribuicao.findFirst({
          where: { criadoEm: { lt: inicioDoMes } },
          orderBy: [{ criadoEm: 'desc' }, { id: 'desc' }],
          select: { valorMensal: true },
        });
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
          select: { id: true },
        });

        const lote = await tx.loteMensal.create({ data: { competencia } });
        for (const { id } of associados) {
          // TODO(#45): usar a edição que a sede fez para o boleto deste mês
          // (RN04).
          await this.transacoes.criarBoleto(tx, {
            associadoId: id,
            loteId: lote.id,
            tipo: 'MENSAL',
            competencia,
            valor: valor.valorMensal,
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
          // 30 dias depois do vencimento (RN03).
          validoAte: new Date(boleto.vencimento.getTime() + 30 * UM_DIA),
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
