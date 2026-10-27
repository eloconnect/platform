import type { AssociadoResumo } from '@eloconnect/shared';

/** Situação em texto, com as marcas à parte (não só cor). */
export function textosSituacao(
  associado: Pick<
    AssociadoResumo,
    'situacao' | 'acessoManual' | 'cancelamentoSolicitado' | 'inativadoEm'
  >,
): string[] {
  const textos = [
    associado.situacao === 'ADIMPLENTE' ? 'Adimplente' : 'Inadimplente',
  ];
  if (associado.cancelamentoSolicitado) textos.push('Cancelamento solicitado');
  if (associado.acessoManual === 'BLOQUEADO') {
    textos.push('Acesso bloqueado pela sede');
  }
  if (associado.acessoManual === 'LIBERADO') {
    textos.push('Acesso liberado pela sede');
  }
  if (associado.inativadoEm) textos.push('Inativado');
  return textos;
}
