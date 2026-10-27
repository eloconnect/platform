import type { AcessoManualStatus, SituacaoAcesso } from './access-policy.js';

/** Associado como a API devolve para a sede. Datas em texto ISO. */
export interface Associado {
  id: string;
  /** Só letras e dígitos, sem pontuação. */
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  email: string | null;
  telefone: string | null;
  municipio: string | null;
  /** "Recebe boleto mensal: sim/não" no painel da sede (RN22). */
  contribuicaoAtiva: boolean;
  situacao: SituacaoAcesso;
  acessoManual: AcessoManualStatus;
  inativadoEm: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

/** Cadastro pela sede (RF08). O CNPJ pode vir com ou sem pontuação. */
export interface CriarAssociadoRequest {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string | null;
  email?: string | null;
  telefone?: string | null;
  municipio?: string | null;
  contribuicaoAtiva?: boolean;
}

/** Edição pela sede: só os campos enviados mudam. */
export type EditarAssociadoRequest = Partial<CriarAssociadoRequest>;

/**
 * Filtro de status da lista (RF06). "Cancelamento solicitado" não é uma
 * situação: é ter um pedido de cancelamento pendente.
 */
export type StatusAssociado =
  'ADIMPLENTE' | 'INADIMPLENTE' | 'CANCELAMENTO_SOLICITADO';

/** Busca e filtros da lista de associados (RF06). */
export interface FiltrosAssociados {
  /** Parte da razão social, do nome fantasia ou do CNPJ. */
  busca?: string;
  status?: StatusAssociado;
  /** "Recebe boleto mensal: sim/não" (RN22). */
  contribuicaoAtiva?: boolean;
  /** Os inativados ficam de fora, a menos que seja true. */
  incluirInativos?: boolean;
  /** Começa em 1. */
  pagina?: number;
}

/** Linha da lista de associados. */
export interface AssociadoResumo {
  id: string;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  situacao: SituacaoAcesso;
  acessoManual: AcessoManualStatus;
  contribuicaoAtiva: boolean;
  /** Tem pedido de cancelamento pendente. */
  cancelamentoSolicitado: boolean;
  inativadoEm: string | null;
}

export interface ListaAssociados {
  itens: AssociadoResumo[];
  total: number;
  pagina: number;
  porPagina: number;
}
