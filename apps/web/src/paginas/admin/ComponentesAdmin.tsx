import type { ReactNode } from 'react';
import { lerSessao } from '../../sessao';
import { IconeRaio } from './icones';

/** Barra superior comum a todas as telas do painel da sede. */
export function TopoAdmin({ plantao = false }: { plantao?: boolean }) {
  const usuario = lerSessao()?.usuario;
  return (
    <div className="adm-topo">
      <span className="adm-conectado">
        <span className="adm-ponto" aria-hidden="true" />
        Sindicato Conectado: SINDIFARMA-SP
      </span>
      <div className="adm-topo-direita">
        {plantao && (
          <button type="button" className="adm-botao-plantao">
            <IconeRaio />
            Plantão Urgente
          </button>
        )}
        <div className="adm-usuario">
          <strong>{usuario?.nome ?? 'Sede'}</strong>
          <span>Diretor Responsável</span>
        </div>
      </div>
    </div>
  );
}

export function CabecalhoAdmin({
  selo,
  titulo,
  descricao,
  acao,
}: {
  selo?: string;
  titulo: string;
  descricao?: string;
  acao?: ReactNode;
}) {
  return (
    <header className="adm-cabecalho">
      <div>
        {selo && (
          <p className="adm-selo">
            <span>{selo}</span>
          </p>
        )}
        <h1>{titulo}</h1>
        {descricao && <p className="adm-descricao">{descricao}</p>}
      </div>
      {acao}
    </header>
  );
}

export function AvisoCarga({
  carregando,
  erro,
}: {
  carregando: boolean;
  erro: string | null;
}) {
  if (erro) {
    return (
      <p className="adm-aviso adm-aviso-erro" role="alert">
        {erro}
      </p>
    );
  }
  return carregando ? (
    <p className="adm-aviso" role="status">
      Carregando...
    </p>
  ) : null;
}
