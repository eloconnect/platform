import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
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
}

/**
 * Bloqueio automático (US16: RF16, RN03, RN09). O cron chama `executar` todo
 * dia. O boleto em aberto que passou do último dia para pagar, 30 dias depois
 * do vencimento, vira EXPIRADO, e o associado passa a inadimplente, o que
 * bloqueia benefícios e suporte. Até lá, o acesso continua. A decisão manual
 * da sede (RN11) não muda: ela continua valendo sobre a situação.
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
    return { dia: textoDia(hoje), expirados, bloqueados };
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
