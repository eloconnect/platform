export type SituacaoSindical = 'EM_DIA' | 'PENDENTE' | 'INADIMPLENTE';

export interface ResumoAdmin {
  totalAssociados: number;
  emDia: number;
  taxaAdimplencia: number;
  arrecadacaoMensal: number;
  valorMensal: number;
}

export interface AssociadoResumo {
  id: string;
  nome: string;
  razaoSocial: string;
  cnpj: string;
  cidade: string;
  situacao: SituacaoSindical;
  bloqueado: boolean;
}

export interface ListaAssociados {
  total: number;
  pagina: number;
  porPagina: number;
  totalPaginas: number;
  itens: AssociadoResumo[];
}

export interface BoletoResumo {
  id: string;
  competencia: string;
  vencimento: string;
  valor: number;
  status: string;
  pagoEm: string | null;
}

export interface FichaAssociado {
  id: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string;
  email: string | null;
  telefone: string | null;
  municipio: string | null;
  filiadoDesde: string;
  situacao: SituacaoSindical;
  bloqueado: boolean;
  boletos: BoletoResumo[];
}

export interface ValoresAdmin {
  valorMensal: number;
  valorAnual: number;
  vigenteDesde: string | null;
  valorAnterior: number | null;
  estabelecimentos: number;
}

export interface CancelamentoPendente {
  id: string;
  razaoSocial: string;
  cnpj: string;
  solicitadaEm: string;
}

export interface ConvencaoPublicada {
  id: string;
  titulo: string;
  ano: number;
  resumo: string;
  publicadaEm: string | null;
  anexos: number;
  arquivos: AnexoConvencaoAdmin[];
}

export interface AnexoConvencaoAdmin {
  id: string;
  nomeArquivo: string;
  tamanhoBytes: number;
}

export interface ConvencaoAdmin {
  id: string;
  titulo: string;
  ano: number;
  resumo: string;
  publicadaEm: string | null;
  anexos: number;
}

export interface DadosConvencao {
  titulo: string;
  ano: number;
  resumo: string;
  publicar: boolean;
}

export interface BeneficioAdmin {
  id: string;
  titulo: string;
  descricao: string;
  ativo: boolean;
  ordem: number;
}

export interface DadosBeneficio {
  titulo: string;
  descricao: string;
  ativo?: boolean;
  ordem: number;
}

export type StatusSolicitacaoSuporte = 'RECEBIDA' | 'EM_ANALISE' | 'CONCLUIDA';

export interface SolicitacaoSuporteAdmin {
  id: string;
  associado: string;
  cnpj: string;
  mensagem: string;
  status: StatusSolicitacaoSuporte;
  criadaEm: string;
  atualizadaEm: string;
}
