/**
 * Boleto avulso: o pagamento de um único mês, pedido pelo associado sem aderir
 * à cobrança recorrente (RN24, RF37). Regras da P10 decididas pelo grupo, com
 * aval do cliente (24/11/2026).
 */

/** Por que a farmácia não pode pedir o boleto avulso agora. */
export type MotivoSemAvulso =
  /** Já recebe o boleto todo mês: o boleto do mês chega pelo lote. */
  | 'RECEBE_BOLETO_MENSAL'
  /** Tem um boleto em aberto: paga esse primeiro. */
  | 'BOLETO_EM_ABERTO'
  /** Tem meses expirados: eles se pagam num boleto só (RN30). */
  | 'BOLETO_EXPIRADO'
  /** O boleto deste mês já foi pago. */
  | 'MES_JA_PAGO'
  /** O plano anual pago cobre este mês (RN13). */
  | 'PLANO_ANUAL'
  /** A sede ainda não cadastrou o valor da contribuição. */
  | 'SEM_VALOR'
  /** O cadastro da farmácia está inativo (P13). */
  | 'INATIVO';

/** O boleto avulso, para o associado logado. */
export interface SituacaoAvulso {
  /** Nulo quando a farmácia pode pedir o boleto agora. */
  motivo: MotivoSemAvulso | null;
  /** Valor do boleto deste mês ("120.00"). Nulo sem valor cadastrado. */
  valor: string | null;
  /** Vencimento do boleto, se for pedido hoje ("AAAA-MM-DD"). */
  vencimento: string;
  /**
   * Até quando a farmácia fica em dia com este boleto pago ("AAAA-MM-DD"): o
   * último dia para pagar o mês seguinte.
   */
  emDiaAte: string;
}

/** O boleto avulso gerado. */
export interface AvulsoGerado {
  boletoId: string;
}
