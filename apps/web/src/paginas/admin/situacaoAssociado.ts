import {
  acessoManualEmVigor,
  textoSituacao,
  type AssociadoResumo,
} from '@eloconnect/shared';

/** Situação em texto, com as marcas à parte (não só cor). */
export function textosSituacao(
  associado: Pick<
    AssociadoResumo,
    | 'situacao'
    | 'contribuicaoAtiva'
    | 'acessoManual'
    | 'acessoManualAte'
    | 'cancelamentoSolicitado'
    | 'inativadoEm'
  >,
): string[] {
  const textos: string[] = [textoSituacao(associado)];
  if (associado.cancelamentoSolicitado) textos.push('Cancelamento solicitado');
  // A liberação vencida não aparece: o acesso voltou a seguir o pagamento (RN11).
  const acessoManual = acessoManualEmVigor(
    associado.acessoManual,
    associado.acessoManualAte,
  );
  if (acessoManual === 'BLOQUEADO') {
    textos.push('Acesso bloqueado pela sede');
  }
  if (acessoManual === 'LIBERADO') {
    textos.push(
      associado.acessoManualAte
        ? `Acesso liberado pela sede até ${new Date(associado.acessoManualAte).toLocaleDateString('pt-BR')}`
        : 'Acesso liberado pela sede',
    );
  }
  if (associado.inativadoEm) textos.push('Inativado');
  return textos;
}
