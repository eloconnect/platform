export type SituacaoAcesso = 'ADIMPLENTE' | 'INADIMPLENTE';
export type AcessoManualStatus = 'LIBERADO' | 'BLOQUEADO' | null;

/**
 * Decide o acesso a recursos que exigem autorização financeira.
 * Notícias e informações gerais não devem chamar esta função.
 */
export function podeAcessarRecursoRestrito(
  situacao: SituacaoAcesso,
  acessoManual: AcessoManualStatus,
): boolean {
  if (acessoManual === 'LIBERADO') {
    return true;
  }

  if (acessoManual === 'BLOQUEADO') {
    return false;
  }

  return situacao === 'ADIMPLENTE';
}

/** A liberação manual vale 7 dias (RN11, resposta 11 do questionário). */
export const DIAS_LIBERACAO_MANUAL = 7;

/**
 * Decisão manual que vale agora (RN11). A liberação vencida deixa de contar, e
 * o acesso volta a seguir o pagamento. Sem job: a data é conferida na hora.
 */
export function acessoManualEmVigor(
  acessoManual: AcessoManualStatus,
  acessoManualAte: Date | string | null,
  agora: Date = new Date(),
): AcessoManualStatus {
  if (
    acessoManual === 'LIBERADO' &&
    acessoManualAte !== null &&
    new Date(acessoManualAte) <= agora
  ) {
    return null;
  }
  return acessoManual;
}
