/** Tamanho máximo do assunto e do texto do comunicado. */
export const LIMITES_COMUNICADO = { assunto: 150, texto: 5000 } as const;

/** Cobrança formal (comunicado) por e-mail, sem boleto (RN19, RF29). */
export interface Comunicado {
  id: string;
  assunto: string;
  /** Texto enviado: o da sede, com o valor e os benefícios no fim. */
  mensagem: string;
  /** Data e hora ISO. */
  criadoEm: string;
  criadoPor: { nome: string };
  /** Associados que recebem o comunicado. */
  total: number;
  /** E-mails que já saíram. */
  enviados: number;
  /** Data e hora ISO do último e-mail; nulo enquanto o envio continua. */
  concluidoEm: string | null;
}

/** O que a tela da cobrança formal mostra (RF29). */
export interface PainelComunicados {
  /** Associados que recebem um comunicado novo. */
  destinatarios: number;
  /** E-mails do comunicado por dia (RNF09). */
  limiteDiario: number;
  /** Do mais novo para o mais antigo. */
  comunicados: Comunicado[];
}

/** Comunicado novo escrito pela sede (RF29). */
export interface CriarComunicadoRequest {
  assunto: string;
  texto: string;
}
