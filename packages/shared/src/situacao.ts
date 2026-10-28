import type { SituacaoAcesso } from './access-policy.js';

export type TextoSituacao =
  'Adimplente' | 'Inadimplente' | 'Sem contribuição ativa';

/**
 * Situação como aparece na tela, para a sede e para o associado (RN22).
 * Quem não está em dia e não contribui aparece como "Sem contribuição ativa",
 * e não "Inadimplente" (resposta 8 do questionário do cliente).
 */
export function textoSituacao({
  situacao,
  contribuicaoAtiva,
}: {
  situacao: SituacaoAcesso;
  contribuicaoAtiva: boolean;
}): TextoSituacao {
  if (situacao === 'ADIMPLENTE') return 'Adimplente';
  return contribuicaoAtiva ? 'Inadimplente' : 'Sem contribuição ativa';
}
