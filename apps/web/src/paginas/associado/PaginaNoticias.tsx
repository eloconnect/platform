import { useState } from 'react';
import { api } from '../../api';
import { useTituloPagina } from '../../componentes';
import { AvisoCarga } from '../admin/ComponentesAdmin';
import { data, useDadosAdmin } from '../admin/useDadosAdmin';
import { Cabecalho } from './componentes';

/** Notícias e avisos publicados pela sede. */
export function PaginaNoticias() {
  useTituloPagina('Notícias');
  const [aberta, setAberta] = useState<string | null>(null);
  const {
    dados: lista,
    erro,
    carregando,
  } = useDadosAdmin((token) => api.associado.noticias(token), []);

  return (
    <>
      <Cabecalho
        selo="INFORMATIVO OFICIAL SINDICAL"
        titulo="Notícias e Avisos do Setor Farmacêutico"
        descricao="Informações oficiais da Anvisa, Ministério da Saúde e Sindicato."
      />
      <AvisoCarga carregando={carregando} erro={erro} />
      {lista?.length === 0 && (
        <p className="as-aviso" role="status">
          Nenhuma notícia publicada ainda.
        </p>
      )}
      {lista?.map((n) => {
        const aberto = aberta === n.id;
        return (
          <article key={n.id} className="as-cartao as-noticia">
            <div>
              <p className="as-etiqueta">Publicado em {data(n.publicadaEm)}</p>
              <h2>{n.titulo}</h2>
              {aberto && <p className="as-descricao">{n.conteudo}</p>}
            </div>
            <button
              type="button"
              className="as-botao as-botao-pequeno"
              aria-expanded={aberto}
              onClick={() => setAberta(aberto ? null : n.id)}
            >
              {aberto ? 'Fechar notícia' : 'Ler notícia completa →'}
            </button>
          </article>
        );
      })}
    </>
  );
}
