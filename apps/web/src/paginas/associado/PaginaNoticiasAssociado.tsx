import type { Noticia } from '@eloconnect/shared';
import { useEffect, useState } from 'react';
import { api } from '../../api';
import { MensagemErro, useTituloPagina } from '../../componentes';
import { ImagemNoticia } from './ImagemNoticia';

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'erro' }
  | { tipo: 'ok'; noticias: Noticia[] };

/**
 * Feed de notícias da sede (RF35), da mais recente para a mais antiga. Todo
 * associado logado vê, em dia ou não (RN28). A imagem, quando há, vem depois
 * do texto.
 */
export function PaginaNoticiasAssociado() {
  useTituloPagina('Notícias');
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' });

  useEffect(() => {
    let ativo = true;
    void api
      .listarNoticias()
      .then((noticias) => ativo && setEstado({ tipo: 'ok', noticias }))
      .catch(() => ativo && setEstado({ tipo: 'erro' }));
    return () => {
      ativo = false;
    };
  }, []);

  return (
    <>
      <h1>Notícias</h1>
      {estado.tipo === 'carregando' && (
        <p role="status">Carregando as notícias...</p>
      )}
      {estado.tipo === 'erro' && (
        <MensagemErro>
          Não foi possível carregar as notícias agora. Tente de novo em alguns
          minutos.
        </MensagemErro>
      )}
      {estado.tipo === 'ok' && estado.noticias.length === 0 && (
        <p>Ainda não há notícias.</p>
      )}
      {estado.tipo === 'ok' &&
        estado.noticias.map((noticia) => (
          <article key={noticia.id} className="mb-5">
            <h2 className="h4 mb-1">{noticia.titulo}</h2>
            <p className="text-body-secondary">
              Publicada em {formatarData(noticia.publicadaEm)}
            </p>
            <p className="texto-com-quebras">{noticia.conteudo}</p>
            {noticia.imagem && (
              <ImagemNoticia noticiaId={noticia.id} imagem={noticia.imagem} />
            )}
          </article>
        ))}
    </>
  );
}

/** Data no horário de Mato Grosso, onde fica a sede. */
function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    timeZone: 'America/Cuiaba',
  });
}
