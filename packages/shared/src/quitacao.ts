import type { Competencia } from './valores.js';

/**
 * Boleto único dos meses em aberto (RN30, RF37): para voltar a ficar em dia,
 * o associado paga todos os meses expirados, sem juros, num boleto só. Ele
 * pede pelo site, e o chave mestre aprova ou recusa antes da emissão.
 */

/** Um mês expirado, que entra no boleto dos meses em aberto. */
export interface MesEmAberto {
  competencia: Competencia;
  /** Valor em reais, com ponto e duas casas ("120.00"). */
  valor: string;
}

export type StatusPedidoQuitacao = 'PENDENTE' | 'APROVADO' | 'RECUSADO';

/** O último pedido do associado, como ele vê. */
export interface PedidoQuitacaoAssociado {
  status: StatusPedidoQuitacao;
  /** Data e hora ISO. */
  solicitadoEm: string;
  decididoEm: string | null;
}

/** Os meses em aberto, para o associado logado. */
export interface SituacaoQuitacao {
  /** Do mais antigo ao mais novo. */
  meses: MesEmAberto[];
  /** Soma dos meses ("360.00"). */
  total: string;
  /** O último pedido, se houver. */
  pedido: PedidoQuitacaoAssociado | null;
  /** O boleto dos meses em aberto já saiu e espera o pagamento. */
  boletoEmAberto: boolean;
}

/** Pedido que espera a decisão da sede, no perfil e no painel. */
export interface PedidoQuitacaoSede {
  id: string;
  associadoId: string;
  razaoSocial: string;
  /** Data e hora ISO. */
  solicitadoEm: string;
  meses: MesEmAberto[];
  total: string;
}

export interface DecidirQuitacaoRequest {
  decisao: 'APROVADO' | 'RECUSADO';
  /** Só a sede vê. */
  observacao?: string;
}
