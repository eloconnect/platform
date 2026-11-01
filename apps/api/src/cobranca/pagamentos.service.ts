import type { ResultadoPagamento } from '@eloconnect/shared';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { FormaPagamento } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  GatewayPagamento,
  type PagamentoConfirmado,
} from './gateway-pagamento.js';
import { GatewaySimulado } from './gateway-simulado.js';
import { TransacoesService } from './transacoes.service.js';
import { competenciaDaData } from './valor-do-mes.js';

/**
 * Baixa automática do pagamento e desbloqueio (US15: RF15, RN10). Quando o
 * banco confirma o pagamento, o boleto vira PAGO, com o evento no histórico, e
 * o associado volta a adimplente, o que desbloqueia benefícios e suporte. Se
 * ele ainda tiver outro boleto expirado, continua inadimplente: os meses em
 * aberto se pagam num boleto só, que passa pela sede (RN30).
 *
 * TODO(#40): o canal da confirmação (notificação do banco ou consulta
 * periódica) depende do estudo. Ele chama `confirmar` com o que o
 * `GatewayPagamento` ler. Até lá, a sede simula o pagamento na demonstração.
 */
@Injectable()
export class PagamentosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transacoes: TransacoesService,
    private readonly auditoria: AuditoriaService,
    private readonly gateway: GatewayPagamento,
  ) {}

  /** Registra o pagamento confirmado pelo banco. */
  confirmar(pagamento: PagamentoConfirmado): Promise<ResultadoPagamento> {
    return this.prisma.$transaction(async (tx) => {
      const boleto = await tx.boleto.findUnique({
        where: { sicrediNossoNumero: pagamento.nossoNumero },
        select: { id: true },
      });
      if (!boleto) {
        throw new NotFoundException('Boleto não encontrado.');
      }
      return this.registrar(tx, boleto.id, pagamento);
    });
  }

  /**
   * Pagamento de mentira, feito pela sede, para a demonstração e os testes.
   * Só existe com o banco simulado: com o banco de verdade, a rota responde
   * que não encontrou o boleto.
   */
  simular(
    usuarioId: string,
    boletoId: string,
    formaPagamento: FormaPagamento,
  ): Promise<ResultadoPagamento> {
    if (!(this.gateway instanceof GatewaySimulado)) {
      throw new NotFoundException('Boleto não encontrado.');
    }
    return this.prisma.$transaction(async (tx) => {
      const boleto = await tx.boleto.findUnique({ where: { id: boletoId } });
      if (!boleto?.sicrediNossoNumero) {
        throw new NotFoundException('Boleto não encontrado.');
      }
      const resultado = await this.registrar(
        tx,
        boleto.id,
        {
          nossoNumero: boleto.sicrediNossoNumero,
          formaPagamento,
          valorPago: boleto.valor,
          pagoEm: new Date(),
        },
        usuarioId,
      );
      if (!resultado.jaEstavaPago) {
        const { ano, mes } = competenciaDaData(boleto.competencia);
        await this.auditoria.registrar(tx, {
          usuarioId,
          acao: 'PAGAMENTO_SIMULADO',
          entidade: 'Boleto',
          entidadeId: boleto.id,
          associadoId: boleto.associadoId,
          valorNovo: {
            competencia: `${ano}-${String(mes).padStart(2, '0')}`,
            valor: boleto.valor.toFixed(2),
            formaPagamento,
          },
        });
      }
      return resultado;
    });
  }

  private async registrar(
    tx: Prisma.TransactionClient,
    boletoId: string,
    pagamento: PagamentoConfirmado,
    usuarioId?: string,
  ): Promise<ResultadoPagamento> {
    // O update trava o boleto. O banco pode avisar o mesmo pagamento duas
    // vezes, e o segundo aviso não muda nada.
    const { count } = await tx.boleto.updateMany({
      where: { id: boletoId, status: { in: ['EM_ABERTO', 'EXPIRADO'] } },
      data: { atualizadoEm: new Date() },
    });
    if (count === 0) {
      const { status } = await tx.boleto.findUniqueOrThrow({
        where: { id: boletoId },
        select: { status: true },
      });
      if (status === 'PAGO') {
        return { boletoId, jaEstavaPago: true, desbloqueado: false };
      }
      throw new ConflictException('Este boleto não pode ser pago.');
    }

    const anterior = await tx.boleto.findUniqueOrThrow({
      where: { id: boletoId },
      select: { valor: true },
    });
    const boleto = await this.transacoes.alterarBoleto(
      tx,
      boletoId,
      { status: 'PAGO', pagoEm: pagamento.pagoEm },
      {
        evento: 'PAGO',
        formaPagamento: pagamento.formaPagamento,
        usuarioId,
        // Guarda o valor pago só quando ele é diferente do valor do boleto.
        ...(pagamento.valorPago.equals(anterior.valor)
          ? {}
          : { detalhes: { valorPago: pagamento.valorPago.toFixed(2) } }),
      },
    );

    // Desbloqueio (RN10), se não sobrou outro boleto expirado.
    const expirados = await tx.boleto.count({
      where: { associadoId: boleto.associadoId, status: 'EXPIRADO' },
    });
    const { count: desbloqueados } =
      expirados === 0
        ? await tx.associado.updateMany({
            where: { id: boleto.associadoId, situacao: 'INADIMPLENTE' },
            data: { situacao: 'ADIMPLENTE' },
          })
        : { count: 0 };
    return { boletoId, jaEstavaPago: false, desbloqueado: desbloqueados > 0 };
  }
}
