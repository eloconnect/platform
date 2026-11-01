import type { HistoricoBoletos } from '@eloconnect/shared';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { GatewayPagamento } from './gateway-pagamento.js';
import { GatewaySimulado } from './gateway-simulado.js';
import {
  competenciaDaData,
  hojeEmMatoGrosso,
  textoDia,
} from './valor-do-mes.js';

/** Histórico de boletos e pagamentos no perfil do associado (US07: RF07). */
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
    return {
      simulacao: this.gateway instanceof GatewaySimulado,
      boletos: boletos.map((boleto) => ({
        id: boleto.id,
        competencia: competenciaDaData(boleto.competencia),
        tipo: boleto.tipo,
        valor: boleto.valor.toFixed(2),
        vencimento: textoDia(boleto.vencimento),
        status: boleto.status,
        vencido: boleto.status === 'EM_ABERTO' && boleto.vencimento < hoje,
        pagoEm: boleto.pagoEm?.toISOString() ?? null,
        formaPagamento: boleto.transacoes[0]?.formaPagamento ?? null,
      })),
    };
  }
}
