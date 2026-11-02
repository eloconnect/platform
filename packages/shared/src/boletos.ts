import { textoCompetencia, type Competencia } from './valores.js';

/**
 * Boleto em aberto, como o associado vê para pagar (US12: RF12, RN06).
 * Valores em reais, com ponto e duas casas (ex.: "130.00"), e dias no
 * formato "AAAA-MM-DD".
 */
export interface BoletoEmAberto {
  id: string;
  competencia: Competencia;
  valor: string;
  /** Dia 10 do mês (RN02). */
  vencimento: string;
  /** Último dia para pagar: 30 dias depois do vencimento (RN03). */
  validoAte: string;
  /** O vencimento já passou, no horário de Mato Grosso. */
  vencido: boolean;
  linhaDigitavel: string;
  pixCopiaECola: string;
}

/** Como o associado pagou (RF30). */
export type FormaPagamento = 'BOLETO' | 'PIX';

export type StatusBoleto =
  'RASCUNHO' | 'EM_ABERTO' | 'PAGO' | 'CANCELADO' | 'EXPIRADO';

export type TipoBoleto = 'MENSAL' | 'AVULSO' | 'ANUAL';

/**
 * Boleto no histórico de boletos e pagamentos, no perfil do associado, para a
 * sede (RF07), e na área do associado (RF31).
 */
export interface BoletoHistorico {
  id: string;
  competencia: Competencia;
  tipo: TipoBoleto;
  valor: string;
  /** "AAAA-MM-DD". */
  vencimento: string;
  status: StatusBoleto;
  /** Em aberto com o vencimento já passado, no horário de Mato Grosso. */
  vencido: boolean;
  /** Data e hora ISO do pagamento. */
  pagoEm: string | null;
  formaPagamento: FormaPagamento | null;
}

/** Histórico de boletos e pagamentos de um associado, para a sede (RF07). */
export interface HistoricoBoletos {
  /** Do mês mais novo para o mais antigo. */
  boletos: BoletoHistorico[];
  /** A API usa o banco simulado, e o chave mestre pode simular pagamentos. */
  simulacao: boolean;
}

/** Pagamento de mentira, feito pela sede, só com o banco simulado. */
export interface SimularPagamentoRequest {
  formaPagamento: FormaPagamento;
}

/** O que a baixa de um pagamento fez (RF15, RN10). */
export interface ResultadoPagamento {
  boletoId: string;
  /** O pagamento já tinha sido registrado, e nada mudou. */
  jaEstavaPago: boolean;
  /** O associado estava bloqueado e voltou a ter acesso. */
  desbloqueado: boolean;
}

/** "2026-12-10" vira "10/12/2026", sem passar por fuso horário. */
export function formatarDia(dia: string): string {
  const [ano, mes, numero] = dia.slice(0, 10).split('-');
  return `${numero}/${mes}/${ano}`;
}

const TIPOS: Record<TipoBoleto, string> = {
  MENSAL: '',
  AVULSO: ' (avulso)',
  ANUAL: ' (plano anual)',
};

const SITUACOES: Record<Exclude<StatusBoleto, 'EM_ABERTO' | 'PAGO'>, string> = {
  RASCUNHO: 'Em emissão',
  CANCELADO: 'Cancelado',
  EXPIRADO: 'Expirado, sem pagamento',
};

const FORMAS: Record<FormaPagamento, string> = {
  PIX: 'Pix',
  BOLETO: 'boleto',
};

/** Mês do boleto, com o tipo quando não é o mensal: "junho de 2099 (avulso)". */
export function textoMesBoleto(
  boleto: Pick<BoletoHistorico, 'competencia' | 'tipo'>,
): string {
  return `${textoCompetencia(boleto.competencia)}${TIPOS[boleto.tipo]}`;
}

/**
 * Situação do boleto em texto claro, a mesma para a sede e para o associado
 * (RF07, RF31): "Em aberto", "Vencido", "Pago em 08/06/2099, com Pix"...
 */
export function textoSituacaoBoleto(
  boleto: Pick<
    BoletoHistorico,
    'status' | 'vencido' | 'pagoEm' | 'formaPagamento'
  >,
): string {
  if (boleto.status === 'EM_ABERTO') {
    return boleto.vencido ? 'Vencido' : 'Em aberto';
  }
  if (boleto.status === 'PAGO') {
    // A data do pagamento no horário de Mato Grosso, onde fica a sede.
    const quando = boleto.pagoEm
      ? ` em ${new Date(boleto.pagoEm).toLocaleDateString('pt-BR', { timeZone: 'America/Cuiaba' })}`
      : '';
    const forma = boleto.formaPagamento
      ? `, com ${FORMAS[boleto.formaPagamento]}`
      : '';
    return `Pago${quando}${forma}`;
  }
  return SITUACOES[boleto.status];
}
