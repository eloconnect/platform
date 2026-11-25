import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ultimoDiaDaCobertura } from './cobertura.js';
import { TransacoesService } from './transacoes.service.js';
import { hojeEmMatoGrosso, textoDia } from './valor-do-mes.js';

const UM_DIA = 24 * 60 * 60 * 1000;

/** O que uma execução fez, para o log da hospedagem. */
export interface ResultadoBloqueio {
  /** Dia da execução, no horário de Mato Grosso. */
  dia: string;
  /** Boletos que passaram da validade nesta execução. */
  expirados: number;
  /** Associados que estavam adimplentes e foram bloqueados. */
  bloqueados: number;
  /**
   * Associados em dia sem o boleto mensal que perderam o acesso nesta
   * execução: a cobrança foi interrompida há mais de 30 dias (RN25), ou o mês
   * pago no boleto avulso deixou de valer (P10).
   */
  fimDoAcesso: number;
}

/**
 * Bloqueio automático (US16: RF16, RN03, RN09). O cron chama `executar` todo
 * dia. O boleto em aberto que passou do último dia para pagar, 30 dias depois
 * do vencimento, vira EXPIRADO, e o associado passa a inadimplente, o que
 * bloqueia benefícios e suporte. Até lá, o acesso continua. A decisão manual
 * da sede (RN11) não muda: ela continua valendo sobre a situação.
 *
 * Também bloqueia quem está em dia sem receber o boleto todo mês, quando o
 * acesso que resta termina: 30 dias depois da interrupção da cobrança pela
 * sede (RN25) ou o fim do mês pago no boleto avulso (P10, `cobertura.ts`).
 * Vale o que terminar por último.
 */
@Injectable()
export class BloqueioService {
  private readonly logger = new Logger(BloqueioService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly transacoes: TransacoesService,
  ) {}

  async executar(agora = new Date()): Promise<ResultadoBloqueio> {
    const hoje = hojeEmMatoGrosso(agora);
    // Vencido há mais de 30 dias: o último dia para pagar já passou.
    const limite = new Date(hoje.getTime() - 30 * UM_DIA);
    const vencidos = await this.prisma.boleto.findMany({
      where: { status: 'EM_ABERTO', vencimento: { lt: limite } },
      select: { id: true },
      orderBy: { id: 'asc' },
    });

    let expirados = 0;
    let bloqueados = 0;
    for (const { id } of vencidos) {
      try {
        const resultado = await this.expirar(id);
        if (resultado) {
          expirados++;
          if (resultado.bloqueado) bloqueados++;
        }
      } catch (erro) {
        this.logger.error(
          `O boleto ${id} não foi marcado como expirado.`,
          erro instanceof Error ? erro.stack : undefined,
        );
      }
    }
    const fimDoAcesso = await this.encerrarAcessoSemBoletoMensal(hoje);
    return { dia: textoDia(hoje), expirados, bloqueados, fimDoAcesso };
  }

  /**
   * Bloqueia quem está em dia sem o boleto mensal e cujo acesso terminou
   * antes de hoje. Devolve quantos foram bloqueados.
   */
  private async encerrarAcessoSemBoletoMensal(hoje: Date): Promise<number> {
    const semBoletoMensal = {
      contribuicaoAtiva: false,
      situacao: 'ADIMPLENTE',
    } as const;
    const candidatos = await this.prisma.associado.findMany({
      where: {
        ...semBoletoMensal,
        OR: [
          { cobrancaInterrompidaEm: { not: null } },
          { boletos: { some: { tipo: 'AVULSO', status: 'PAGO' } } },
        ],
      },
      select: {
        id: true,
        cobrancaInterrompidaEm: true,
        boletos: {
          where: { tipo: 'AVULSO', status: 'PAGO' },
          orderBy: { competencia: 'desc' },
          take: 1,
          select: { competencia: true },
        },
      },
    });
    const ids = candidatos
      .filter(({ cobrancaInterrompidaEm, boletos }) => {
        const fins = [
          // O último dia com acesso é o dia da interrupção mais 30 dias.
          cobrancaInterrompidaEm &&
            new Date(
              hojeEmMatoGrosso(cobrancaInterrompidaEm).getTime() + 30 * UM_DIA,
            ),
          boletos[0] && ultimoDiaDaCobertura(boletos[0].competencia),
        ].filter((fim): fim is Date => fim instanceof Date);
        return fins.every((fim) => fim < hoje);
      })
      .map(({ id }) => id);
    if (ids.length === 0) return 0;
    // Confere de novo: um pagamento ou uma adesão no meio do caminho vale.
    const { count } = await this.prisma.associado.updateMany({
      where: { id: { in: ids }, ...semBoletoMensal },
      data: { situacao: 'INADIMPLENTE' },
    });
    return count;
  }

  /**
   * Marca o boleto como expirado e bloqueia o associado. Devolve nulo se o
   * boleto saiu de EM_ABERTO enquanto isso, como no pagamento confirmado
   * pelo banco.
   */
  private expirar(id: string) {
    return this.prisma.$transaction(async (tx) => {
      // O update trava o boleto até o fim da transação.
      const { count } = await tx.boleto.updateMany({
        where: { id, status: 'EM_ABERTO' },
        data: { atualizadoEm: new Date() },
      });
      if (count === 0) return null;

      const boleto = await this.transacoes.alterarBoleto(
        tx,
        id,
        { status: 'EXPIRADO' },
        { evento: 'EXPIRADO' },
      );
      const associado = await tx.associado.updateMany({
        where: { id: boleto.associadoId, situacao: 'ADIMPLENTE' },
        data: { situacao: 'INADIMPLENTE' },
      });
      return { bloqueado: associado.count > 0 };
    });
  }
}
