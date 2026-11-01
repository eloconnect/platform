import type { AcessoManualStatus, SituacaoAcesso } from './access-policy.js';
import type { TextoSituacao } from './situacao.js';
import type { Competencia } from './valores.js';

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
  /** Fim da liberação manual (RN11). Use `acessoManualEmVigor` para saber se ainda vale. */
  acessoManualAte: string | null;
  inativadoEm: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export type StatusCancelamento = 'PENDENTE' | 'APROVADA' | 'RECUSADA';

/** Pedido de cancelamento feito pelo associado. Datas em texto ISO. */
export interface SolicitacaoCancelamento {
  id: string;
  status: StatusCancelamento;
  motivo: string | null;
  observacaoSede: string | null;
  solicitadaEm: string;
  decididaEm: string | null;
  /** Quem da sede aprovou ou recusou. */
  decididaPor: { nome: string } | null;
}

/** Conta de acesso criada pelo associado (RF05). Datas em texto ISO. */
export interface ContaAcesso {
  email: string;
  criadaEm: string;
  /** Nulo enquanto a senha não foi criada pelo link do e-mail. */
  confirmadaEm: string | null;
}

/**
 * Boleto mensal do mês seguinte, cujo valor a sede pode mudar só para ele
 * (RN04, RF11). Valores em reais, com ponto e duas casas (ex.: "130.00").
 */
export interface ProximoBoleto {
  competencia: Competencia;
  /** Valor da contribuição para o mês; nulo enquanto a sede não cadastrou. */
  valorNormal: string | null;
  /** Valor mudado pela sede só para este boleto; nulo se não mudou. */
  valorEditado: string | null;
}

/** Perfil do associado para a sede (RF07). */
export interface AssociadoDetalhe extends Associado {
  /** Da mais recente para a mais antiga. */
  cancelamentos: SolicitacaoCancelamento[];
  /** Nulo enquanto o associado não pediu a criação da conta. */
  conta: ContaAcesso | null;
  /** Nulo para quem não recebe o boleto mensal. */
  proximoBoleto: ProximoBoleto | null;
  /** Nulo se a sede não interrompeu a cobrança, ou se ela foi ativada de novo. */
  interrupcaoCobranca: InterrupcaoCobranca | null;
}

/** Cobrança recorrente interrompida pela sede (RF38, RN25). */
export interface InterrupcaoCobranca {
  /** Data e hora ISO. */
  interrompidaEm: string;
  /** Último dia com acesso, se o associado estava em dia ("AAAA-MM-DD"). */
  acessoAte: string;
}

/** Pedido da sede para interromper a cobrança recorrente (RF38). */
export interface InterromperCobrancaRequest {
  /** Fica só no log de auditoria. */
  motivo: string;
}

/** Novo valor do boleto do mês seguinte (RF11). */
export interface EditarProximoBoletoRequest {
  /** Em reais, com ponto e duas casas (ex.: "130.00"). */
  valor: string;
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
 * Decisão manual da sede sobre o acesso a benefícios e suporte (RF09, RN11).
 * Prevalece sobre a situação automática até a sede mudar de novo.
 */
export interface DefinirAcessoRequest {
  /** null: o acesso volta a seguir o pagamento. */
  acessoManual: AcessoManualStatus;
  /** Por que a sede mudou o acesso. Fica só no log de auditoria. */
  motivo: string;
}

/**
 * Filtro de status da lista (RF06). INADIMPLENTE é quem tem contribuição
 * ativa e está em atraso; SEM_CONTRIBUICAO é quem não está em dia e não
 * contribui (RN22). "Cancelamento solicitado" não é uma situação: é ter um
 * pedido de cancelamento pendente.
 */
export type StatusAssociado =
  | 'ADIMPLENTE'
  | 'INADIMPLENTE'
  | 'SEM_CONTRIBUICAO'
  | 'CANCELAMENTO_SOLICITADO';

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
  acessoManualAte: string | null;
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

/** O que o associado vê na área dele (RN22, RN11). */
export interface MinhaConta {
  nome: string;
  situacao: TextoSituacao;
  /** Data de fim da liberação manual em vigor; nulo sem liberação (RN11). */
  acessoLiberadoAte: string | null;
}
