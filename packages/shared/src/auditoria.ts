/**
 * Catálogo das ações gravadas no log de auditoria (RN26, RF39).
 * Cada funcionalidade nova da sede acrescenta as suas ações aqui.
 */
export const ACOES_AUDITORIA = [
  // Associados
  'ASSOCIADO_CRIADO',
  'ASSOCIADO_EDITADO',
  'ASSOCIADO_INATIVADO',
  'ASSOCIADO_REATIVADO',
  'CONTRIBUICAO_ATIVADA',
  'CONTRIBUICAO_INTERROMPIDA',
  // Troca do e-mail de acesso junto com o do cadastro (RN34)
  'CONTA_EMAIL_ALTERADO',
  // Acesso manual (RN11): bloquear, liberar ou voltar a seguir o pagamento
  'ACESSO_BLOQUEADO',
  'ACESSO_LIBERADO',
  'ACESSO_AUTOMATICO',
  // Cobrança (já usadas pelo seed; as telas vêm na M2 e na M3)
  'VALOR_ALTERADO',
  'LOTE_ENVIADO',
] as const;

export type AcaoAuditoria = (typeof ACOES_AUDITORIA)[number];
