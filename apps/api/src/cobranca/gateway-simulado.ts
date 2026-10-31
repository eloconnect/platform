import { randomInt } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import type { FormaPagamento } from '../generated/prisma/enums.js';
import {
  type BoletoEmitido,
  GatewayPagamento,
  type PagamentoConfirmado,
  type PedidoBoleto,
  type SituacaoNoBanco,
} from './gateway-pagamento.js';

/** A notificação que o banco simulado manda quando o boleto é pago. */
export interface NotificacaoSimulada {
  nossoNumero: string;
  formaPagamento: FormaPagamento;
  /** Em reais, com duas casas: "120.00". */
  valorPago: string;
  /** Data e hora no formato ISO. */
  pagoEm: string;
}

/**
 * Banco de mentira, para desenvolver sem o convênio com o Sicredi (RNF08).
 * Gera nosso número, linha digitável e Pix fictícios, que nenhum banco
 * aceita, e guarda os boletos na memória do processo: serve para o
 * desenvolvimento e os testes. Como simular o pagamento na demonstração, em
 * que cada chamada pode cair num processo novo, é decisão da #48.
 */
@Injectable()
export class GatewaySimulado extends GatewayPagamento {
  private readonly boletos = new Map<
    string,
    { valor: Prisma.Decimal; situacao: SituacaoNoBanco }
  >();

  async emitir({ valor }: PedidoBoleto): Promise<BoletoEmitido> {
    const numero = String(randomInt(10 ** 12)).padStart(12, '0');
    const nossoNumero = `SIM${numero}`;
    const centavos = valor.mul(100).toFixed(0).padStart(10, '0');
    this.boletos.set(nossoNumero, {
      valor,
      situacao: { situacao: 'EM_ABERTO' },
    });
    return {
      nossoNumero,
      // 47 dígitos, como a linha de verdade, com o valor no fim.
      linhaDigitavel: `74891.00000 ${numero.slice(0, 5)}.${numero.slice(5, 11)} ${numero.slice(11)}0000.000000 0 0000${centavos}`,
      pixCopiaECola: `00020101-pix-simulado-${nossoNumero}`,
    };
  }

  async consultar(nossoNumero: string): Promise<SituacaoNoBanco> {
    return this.buscar(nossoNumero).situacao;
  }

  async cancelar(nossoNumero: string): Promise<void> {
    const boleto = this.buscar(nossoNumero);
    if (boleto.situacao.situacao === 'PAGO') {
      throw new ConflictException('O boleto já foi pago.');
    }
    boleto.situacao = { situacao: 'CANCELADO' };
  }

  /**
   * Simula o associado pagando o boleto no banco. Devolve a notificação que o
   * banco mandaria para a API.
   */
  pagar(
    nossoNumero: string,
    formaPagamento: FormaPagamento,
    pagoEm = new Date(),
  ): NotificacaoSimulada {
    const boleto = this.buscar(nossoNumero);
    if (boleto.situacao.situacao !== 'EM_ABERTO') {
      throw new ConflictException(
        boleto.situacao.situacao === 'PAGO'
          ? 'O boleto já foi pago.'
          : 'O boleto foi cancelado.',
      );
    }
    boleto.situacao = {
      situacao: 'PAGO',
      pagamento: {
        nossoNumero,
        formaPagamento,
        valorPago: boleto.valor,
        pagoEm,
      },
    };
    return {
      nossoNumero,
      formaPagamento,
      valorPago: boleto.valor.toFixed(2),
      pagoEm: pagoEm.toISOString(),
    };
  }

  lerNotificacao(corpo: unknown): PagamentoConfirmado {
    const campo = (nome: keyof NotificacaoSimulada): string => {
      const valor: unknown =
        typeof corpo === 'object' && corpo !== null
          ? Reflect.get(corpo, nome)
          : undefined;
      return typeof valor === 'string' ? valor : '';
    };
    const nossoNumero = campo('nossoNumero');
    const formaPagamento = campo('formaPagamento');
    const valorPago = campo('valorPago');
    const pagoEm = new Date(campo('pagoEm'));
    if (
      !nossoNumero ||
      (formaPagamento !== 'BOLETO' && formaPagamento !== 'PIX') ||
      !/^\d+\.\d{2}$/.test(valorPago) ||
      Number.isNaN(pagoEm.getTime())
    ) {
      throw new BadRequestException('Notificação de pagamento inválida.');
    }
    return {
      nossoNumero,
      formaPagamento,
      valorPago: new Prisma.Decimal(valorPago),
      pagoEm,
    };
  }

  private buscar(nossoNumero: string) {
    const boleto = this.boletos.get(nossoNumero);
    if (!boleto) {
      throw new NotFoundException('Boleto não encontrado no banco.');
    }
    return boleto;
  }
}
