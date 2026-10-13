export interface BoletoAtual {
  id: string;
  competencia: string;
  vencimento: string;
  valor: number;
  status: string;
  linhaDigitavel: string | null;
  pixCopiaECola: string | null;
}

export interface PainelAssociado {
  nomeUsuario: string;
  farmacia: {
    razaoSocial: string;
    nomeFantasia: string | null;
    cnpj: string;
    situacao: 'EM_DIA' | 'INADIMPLENTE';
  };
  valorMensal: number;
  valorAnual: number;
  recorrente: boolean;
  cancelamentoPendente: boolean;
  boleto: BoletoAtual | null;
}

export interface PagamentoHistorico {
  id: string;
  competencia: string;
  pagoEm: string | null;
  valor: number;
}

export interface HistoricoAssociado {
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string;
  emDia: boolean;
  itens: PagamentoHistorico[];
  totalPeriodo: number;
}

export interface ConvencaoAssociado {
  id: string;
  titulo: string;
  ano: number;
  resumo: string;
  publicadaEm: string | null;
  inscrito: boolean;
  podeInscrever: boolean;
  anexos: number;
  arquivos: {
    id: string;
    nomeArquivo: string;
    tamanhoBytes: number;
  }[];
}

export interface NoticiaAssociado {
  id: string;
  titulo: string;
  conteudo: string;
  publicadaEm: string | null;
}

export interface BeneficioAssociado {
  id: string;
  titulo: string;
  descricao: string;
}

export interface InscricaoConvencaoResponse {
  inscritaEm: string;
}

export interface SolicitacaoSuporteResponse {
  id: string;
  status: 'RECEBIDA';
  criadaEm: string;
}
