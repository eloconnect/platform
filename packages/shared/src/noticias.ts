/** Notícia do feed, como a API devolve (RF35, RF41). */
export interface Noticia {
  id: string;
  titulo: string;
  conteudo: string;
  /** Data e hora da publicação, em texto ISO. */
  publicadaEm: string;
}

/** Publicação de notícia pela sede (RF41). */
export interface PublicarNoticiaRequest {
  titulo: string;
  conteudo: string;
}

/** Edição pela sede: só os campos enviados mudam. */
export type EditarNoticiaRequest = Partial<PublicarNoticiaRequest>;
