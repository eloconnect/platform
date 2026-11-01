import type { Prisma } from '../generated/prisma/client.js';
import type { FormaPagamento } from '../generated/prisma/enums.js';

const UM_DIA = 24 * 60 * 60 * 1000;

/** Último dia para pagar: 30 dias depois do vencimento (RN03). */
export function validoAte(vencimento: Date): Date {
  return new Date(vencimento.getTime() + 30 * UM_DIA);
}

/** O que o banco precisa para emitir um boleto com Pix (RN06). */
export interface PedidoBoleto {
  /** Id do boleto no sistema. */
  boletoId: string;
  valor: Prisma.Decimal;
  /** Dia 10 do mês (RN02). */
  vencimento: Date;
  /** Último dia para pagar: 30 dias depois do vencimento (RN03). */
  validoAte: Date;
  pagador: {
    cnpj: string;
    /** Razão social. */
    nome: string;
    // TODO(#40): o Sicredi pode exigir o endereço e o CEP, que o cadastro
    // ainda não tem.
  };
}

/** O que o banco devolve na emissão, para guardar no boleto. */
export interface BoletoEmitido {
  nossoNumero: string;
  linhaDigitavel: string;
  pixCopiaECola: string;
}

/** Pagamento confirmado pelo banco. */
export interface PagamentoConfirmado {
  nossoNumero: string;
  formaPagamento: FormaPagamento;
  valorPago: Prisma.Decimal;
  pagoEm: Date;
}

/** Situação do boleto no banco. */
export type SituacaoNoBanco =
  | { situacao: 'EM_ABERTO' | 'CANCELADO' }
  | { situacao: 'PAGO'; pagamento: PagamentoConfirmado };

/**
 * Banco que emite os boletos e confirma os pagamentos. Enquanto o sindicato
 * não tem o convênio com o Sicredi (RNF08), a API usa o `GatewaySimulado`.
 *
 * TODO(#40): adaptador do Sicredi, com as credenciais lidas das variáveis de
 * ambiente da hospedagem (RNF04). O estudo também decide se o pagamento chega
 * pela notificação do banco, pela consulta ou pelas duas (#48).
 */
export abstract class GatewayPagamento {
  /** Emite o boleto com Pix, sem juros e sem multa (RN08). */
  abstract emitir(pedido: PedidoBoleto): Promise<BoletoEmitido>;

  /**
   * PDF do boleto emitido, como o banco gera, para mandar ao associado
   * (RF12). TODO(#40): conferir como o Sicredi devolve o PDF.
   */
  abstract pdf(boleto: PedidoBoleto & BoletoEmitido): Promise<Buffer>;

  abstract consultar(nossoNumero: string): Promise<SituacaoNoBanco>;

  /** O banco não cancela boleto pago. */
  abstract cancelar(nossoNumero: string): Promise<void>;

  /**
   * Lê a notificação de pagamento que o banco manda para a API.
   * TODO(#40): conferir que ela veio mesmo do banco.
   */
  abstract lerNotificacao(corpo: unknown): PagamentoConfirmado;
}
