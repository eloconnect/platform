import type { BoletoEmAberto } from './boletos.js';
import type { TextoSituacao } from './situacao.js';

/**
 * Matriz e filiais (RN31, RF43). Decisão do grupo, com aval do cliente (P14,
 * 24/11/2026): a contribuição continua por CNPJ, e cada filial tem a própria
 * situação; a conta da matriz vê a situação e os boletos em aberto de cada
 * filial, e paga por eles. A ligação é pela raiz do CNPJ (os 8 primeiros
 * dígitos), sem a sede precisar fazer nada.
 */
export interface Filial {
  id: string;
  cnpj: string;
  nome: string;
  situacao: TextoSituacao;
  boletos: BoletoEmAberto[];
}

/** A matriz é o CNPJ de ordem 0001 (dígitos 9 a 12). */
export function ehMatriz(cnpj: string): boolean {
  return cnpj.slice(8, 12) === '0001';
}

/** Raiz do CNPJ: os 8 primeiros dígitos, iguais na matriz e nas filiais. */
export function raizCnpj(cnpj: string): string {
  return cnpj.slice(0, 8);
}
