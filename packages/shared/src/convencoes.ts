export type TipoAnexoConvencao = 'INTEGRAL' | 'RESUMIDA';

export interface AnexoConvencao {
  id: string;
  tipo: TipoAnexoConvencao;
  nomeArquivo: string;
  tamanhoBytes: number;
}

export interface Convencao {
  id: string;
  titulo: string;
  ano: number;
  resumo: string;
  publicadaEm: string | null;
  criadoEm: string;
  atualizadoEm: string;
  anexos: AnexoConvencao[];
}

export interface CriarConvencaoRequest {
  titulo: string;
  ano: number;
  resumo: string;
}

export type EditarConvencaoRequest = Partial<CriarConvencaoRequest>;
