import type { Competencia } from './valores.js';

/**
 * Boleto em aberto, como o associado vê para pagar (US12: RF12, RN06).
 * Valores em reais, com ponto e duas casas (ex.: "130.00"), e dias no
 * formato "AAAA-MM-DD".
 */
export interface BoletoEmAberto {
  id: string;
  competencia: Competencia;
  valor: string;
  /** Dia 10 do mês (RN02). */
  vencimento: string;
  /** Último dia para pagar: 30 dias depois do vencimento (RN03). */
  validoAte: string;
  /** O vencimento já passou, no horário de Mato Grosso. */
  vencido: boolean;
  linhaDigitavel: string;
  pixCopiaECola: string;
}

/** Como o associado pagou (RF30). */
export type FormaPagamento = 'BOLETO' | 'PIX';

/** Pagamento de mentira, feito pela sede, só com o banco simulado. */
export interface SimularPagamentoRequest {
  formaPagamento: FormaPagamento;
}

/** O que a baixa de um pagamento fez (RF15, RN10). */
export interface ResultadoPagamento {
  boletoId: string;
  /** O pagamento já tinha sido registrado, e nada mudou. */
  jaEstavaPago: boolean;
  /** O associado estava bloqueado e voltou a ter acesso. */
  desbloqueado: boolean;
}

/** "2026-12-10" vira "10/12/2026", sem passar por fuso horário. */
export function formatarDia(dia: string): string {
  const [ano, mes, numero] = dia.slice(0, 10).split('-');
  return `${numero}/${mes}/${ano}`;
}
