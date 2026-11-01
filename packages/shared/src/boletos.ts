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

/** "2026-12-10" vira "10/12/2026", sem passar por fuso horário. */
export function formatarDia(dia: string): string {
  const [ano, mes, numero] = dia.slice(0, 10).split('-');
  return `${numero}/${mes}/${ano}`;
}
