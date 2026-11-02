import type { BoletoHistorico, HistoricoBoletos } from '@eloconnect/shared';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { GatewayPagamento } from './gateway-pagamento.js';
import { GatewaySimulado } from './gateway-simulado.js';
import {
  competenciaDaData,
  hojeEmMatoGrosso,
  textoDia,
} from './valor-do-mes.js';

/**
 * Histórico de boletos e pagamentos de um associado: no perfil, para a sede
 * (US07: RF07), e na área do associado (US31: RF31).
 */
@Injectable()
export class HistoricoBoletosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: GatewayPagamento,
  ) {}

  async listar(
    associadoId: string,
    agora = new Date(),
  ): Promise<HistoricoBoletos> {
    const associado = await this.prisma.associado.findUnique({
      where: { id: associadoId },
      select: { id: true },
    });
    if (!associado) {
      throw new NotFoundException('Associado não encontrado.');
    }
    return {
      simulacao: this.gateway instanceof GatewaySimulado,
      boletos: await this.boletos(associadoId, agora),
    };
  }

  /** Todos os boletos do associado, do mês mais novo para o mais antigo. */
  async boletos(
    associadoId: string,
    agora = new Date(),
  ): Promise<BoletoHistorico[]> {
    const boletos = await this.prisma.boleto.findMany({
      where: { associadoId },
      orderBy: [
        { competencia: 'desc' },
        { vencimento: 'desc' },
        { id: 'desc' },
      ],
      include: {
        // A forma de pagamento fica no histórico de transações (RF30).
        transacoes: {
          where: { evento: 'PAGO' },
          select: { formaPagamento: true },
          orderBy: { ocorridoEm: 'desc' },
          take: 1,
        },
      },
    });
    const hoje = hojeEmMatoGrosso(agora);
    return boletos.map((boleto) => ({
      id: boleto.id,
      competencia: competenciaDaData(boleto.competencia),
      tipo: boleto.tipo,
      valor: boleto.valor.toFixed(2),
      vencimento: textoDia(boleto.vencimento),
      status: boleto.status,
      vencido: boleto.status === 'EM_ABERTO' && boleto.vencimento < hoje,
      pagoEm: boleto.pagoEm?.toISOString() ?? null,
      formaPagamento: boleto.transacoes[0]?.formaPagamento ?? null,
    }));
  }
}
