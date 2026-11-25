import type { Competencia } from './valores.js';

/**
 * Plano anual à vista, com 20% de desconto (RN13, RF17). Regras da P04
 * decididas pelo grupo, com aval do cliente (24/11/2026).
 */

/** Por que a farmácia não pode pedir o plano anual agora. */
export type MotivoSemAnual =
  /** O plano anual pago ainda vale. */
  | 'PLANO_EM_VIGOR'
  /** Tem um boleto para pagar, inclusive o do plano anual. */
  | 'BOLETO_EM_ABERTO'
  /** Tem meses expirados: eles se pagam num boleto só (RN30). */
  | 'BOLETO_EXPIRADO'
  /** A sede ainda não cadastrou o valor da contribuição. */
  | 'SEM_VALOR'
  /** O cadastro da farmácia está inativo (P13). */
  | 'INATIVO';

/** O plano anual, para o associado logado. */
export interface SituacaoAnual {
  /** Nulo quando a farmácia pode pedir o plano agora. */
  motivo: MotivoSemAnual | null;
  /** Valor à vista do ano ("1152.00"). Nulo sem valor cadastrado. */
  valorAnual: string | null;
  /** Valor do boleto mensal, para mostrar a economia ("120.00"). */
  valorMensal: string | null;
  /** Primeiro e último mês que o plano pedido hoje cobre. */
  primeiroMes: Competencia;
  ultimoMes: Competencia;
  /** Vencimento do boleto, se for pedido hoje ("AAAA-MM-DD"). */
  vencimento: string;
  /** Até quando fica em dia com o plano pago, sem o boleto mensal. */
  emDiaAte: string;
  /** Último mês do plano pago em vigor; nulo sem plano. */
  planoAte: Competencia | null;
}

/** O boleto do plano anual gerado. */
export interface AnualGerado {
  boletoId: string;
}
