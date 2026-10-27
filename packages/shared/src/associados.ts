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
