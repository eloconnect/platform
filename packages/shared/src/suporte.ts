import type { Beneficio } from './beneficios.js';

/**
 * Benefícios e suporte para o associado (US25: RF25, RN32). Regras da P06 e
 * da P15 decididas pelo grupo, com aval do cliente (24/11/2026).
 */
export interface BeneficiosAssociado {
  beneficios: Beneficio[];
  /** Consultoria e suporte: quem está em dia ou liberado pela sede. */
  consultoriaLiberada: boolean;
  /** Assessoria jurídica: o plano anual em vigor ou a liberação da sede. */
  juridicaLiberada: boolean;
}

/** Limites do pedido de suporte. */
export const LIMITES_SUPORTE = { assunto: 120, mensagem: 2000 } as const;

export interface EnviarSuporteRequest {
  assunto: string;
  mensagem: string;
}

/** Pedido de suporte, como a sede vê. */
export interface PedidoSuporte {
  id: string;
  associado: { id: string; razaoSocial: string; email: string | null };
  assunto: string;
  mensagem: string;
  /** Data e hora ISO. */
  criadoEm: string;
  respondidoEm: string | null;
  respondidoPor: string | null;
}
