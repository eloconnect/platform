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
