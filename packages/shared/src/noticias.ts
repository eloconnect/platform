/** Notícia do feed, como a API devolve (RF35, RF41). */
export interface Noticia {
  id: string;
  titulo: string;
  conteudo: string;
  /** Data e hora da publicação, em texto ISO. */
  publicadaEm: string;
  /** Nula quando a notícia não tem imagem. */
  imagem: ImagemNoticia | null;
}

/** Imagem opcional da notícia (RF41). O arquivo vem de `baixarImagemNoticia`. */
export interface ImagemNoticia {
  /** Descrição para quem usa leitor de tela (RNF02). Opcional. */
  descricao: string | null;
}

/** Publicação de notícia pela sede (RF41). */
export interface PublicarNoticiaRequest {
  titulo: string;
  conteudo: string;
}

/** Edição pela sede: só os campos enviados mudam. */
export type EditarNoticiaRequest = Partial<PublicarNoticiaRequest>;

/**
 * Imagem enviada pela sede. Sem o arquivo, só a descrição muda, e a notícia
 * precisa já ter imagem. A descrição vazia tira a descrição.
 */
export interface EnviarImagemNoticiaRequest {
  imagem?: Blob;
  descricao: string;
}

/** Formatos aceitos para a imagem da notícia. */
export const TIPOS_IMAGEM_NOTICIA: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

/** A Vercel aceita no máximo 4,5 MB por requisição. */
export const TAMANHO_MAXIMO_IMAGEM_NOTICIA = 4 * 1024 * 1024;
