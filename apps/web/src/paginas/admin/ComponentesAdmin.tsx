import type { ReactNode } from 'react';
import { lerSessao } from '../../sessao';

/** Barra superior comum a todas as telas do painel da sede. */
export function TopoAdmin() {
  const usuario = lerSessao()?.usuario;
  return (
    <div className="adm-topo">
      <span className="adm-conectado">
        <span className="adm-ponto" aria-hidden="true" />
        Painel da sede
      </span>
      <div className="adm-topo-direita">
        <div className="adm-usuario">
          <strong>{usuario?.nome ?? 'Sede'}</strong>
          <span>Administrador</span>
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
