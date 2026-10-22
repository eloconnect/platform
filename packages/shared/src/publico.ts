export interface ConfiguracaoPublicaPaginaInicial {
  titulo: string;
  descricao: string;
  imagemUrl: string | null;
  imagemAlt: string | null;
}

export interface BeneficioPublico {
  id: string;
  titulo: string;
  descricao: string;
}

export interface ConvencaoPublica {
  id: string;
  titulo: string;
  ano: number;
  resumo: string;
}

export interface NoticiaPublica {
  id: string;
  titulo: string;
  conteudo: string;
  publicadaEm: string;
}
export interface PaginaInicialResponse {
  configuracao: ConfiguracaoPublicaPaginaInicial;
  beneficios: BeneficioPublico[];
  convencoes: ConvencaoPublica[];
  noticias: NoticiaPublica[];
}
