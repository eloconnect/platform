import { Icone, type NomeIcone } from './Icone';

type Tom = 'ok' | 'atraso' | 'aviso' | 'neutro';

const ICONE_DO_TOM: Record<Tom, NomeIcone> = {
  ok: 'visto',
  atraso: 'atencao',
  aviso: 'relogio',
  neutro: 'traco',
};

function tomDaSituacao(situacao: string): Tom {
  if (situacao === 'Adimplente') return 'ok';
  if (situacao === 'Inadimplente' || situacao.includes('bloqueado')) {
    return 'atraso';
  }
  if (situacao === 'Cancelamento solicitado' || situacao.includes('liberado')) {
    return 'aviso';
  }
  return 'neutro';
}

/**
 * Situação com ícone e palavra, nunca só por cor (RNF02). O texto é o que as
 * regras definem (RN22); o componente só escolhe o visual.
 */
export function EtiquetaSituacao({
  situacao,
  prefixo = '',
}: {
  situacao: string;
  /** Texto antes da situação, dentro da mesma etiqueta. */
  prefixo?: string;
}) {
  const tom = tomDaSituacao(situacao);
  return (
    <span className={`elo-situacao elo-situacao--${tom}`}>
      <Icone nome={ICONE_DO_TOM[tom]} />
      {`${prefixo}${situacao}`}
    </span>
  );
}
