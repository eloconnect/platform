import type {
  BoletoHistorico,
  FormatoExportacao,
  HistoricoBoletos,
} from '@eloconnect/shared';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { csvHistorico, pdfHistorico } from './exportar-historico.js';
import { GatewayPagamento } from './gateway-pagamento.js';
import { GatewaySimulado } from './gateway-simulado.js';
import {
  competenciaDaData,
  hojeEmMatoGrosso,
  textoDia,
} from './valor-do-mes.js';

/**
 * Histórico de boletos e pagamentos de um associado: no perfil, para a sede
 * (US07: RF07), que também o exporta em PDF ou CSV (US32: RF32), e na área do
 * associado (US31: RF31).
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

  /**
   * Histórico em PDF ou CSV, para a sede comprovar a contribuição ou a não
   * contribuição do associado (US32: RF32).
   */
  async exportar(
    associadoId: string,
    formato: FormatoExportacao,
    agora = new Date(),
  ): Promise<{ arquivo: Buffer; nomeArquivo: string }> {
    const associado = await this.prisma.associado.findUnique({
      where: { id: associadoId },
      select: { razaoSocial: true, cnpj: true },
    });
    if (!associado) {
      throw new NotFoundException('Associado não encontrado.');
    }
    const boletos = await this.boletos(associadoId, agora);
    return {
      arquivo:
        formato === 'pdf'
          ? pdfHistorico({ ...associado, emitidoEm: agora, boletos })
          : csvHistorico(boletos),
      nomeArquivo: `historico-${associado.cnpj}.${formato}`,
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
