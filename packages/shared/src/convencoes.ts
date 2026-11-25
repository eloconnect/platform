export type TipoAnexoConvencao = 'INTEGRAL' | 'RESUMIDA';

export interface AnexoConvencao {
  id: string;
  tipo: TipoAnexoConvencao;
  nomeArquivo: string;
  tamanhoBytes: number;
}

/**
 * Uma linha da tabela de reajuste salarial da convenção (US21: RF21). Formato
 * decidido pelo grupo, com aval do cliente (P24, 24/11/2026). Valores em
 * reais, com ponto e duas casas ("1050.00").
 */
export interface LinhaReajuste {
  funcao: string;
  pisoAnterior: string;
  pisoNovo: string;
}

/** Linhas que a tabela aceita. */
export const MAXIMO_LINHAS_REAJUSTE = 50;

/** Reajuste da linha em porcentagem, com uma casa ("5,0%"). */
export function textoReajuste({ pisoAnterior, pisoNovo }: LinhaReajuste) {
  const anterior = Number(pisoAnterior);
  if (!(anterior > 0)) return '';
  const percentual = ((Number(pisoNovo) - anterior) / anterior) * 100;
  return `${percentual.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

export interface Convencao {
  id: string;
  titulo: string;
  ano: number;
  resumo: string;
  /**
   * Para o associado, vazia quando ele não está em dia: a tabela fica junto
   * com o PDF completo (RN12).
   */
  tabelaReajuste: LinhaReajuste[];
  /** A convenção tem tabela, mas o associado não está em dia para vê-la. */
  tabelaRestrita: boolean;
  /**
   * Para o associado: quando a farmácia se inscreveu (data e hora ISO), ou
   * nulo. Para a sede, sempre nulo (RF23).
   */
  inscritaEm: string | null;
  /** Para o associado: está em dia e pode se inscrever (RF23). */
  inscricaoPermitida: boolean;
  /** Para a sede: quantas farmácias se inscreveram. */
  inscritas: number;
  publicadaEm: string | null;
  criadoEm: string;
  atualizadoEm: string;
  anexos: AnexoConvencao[];
}

export interface CriarConvencaoRequest {
  titulo: string;
  ano: number;
  resumo: string;
  tabelaReajuste?: LinhaReajuste[];
}

export type EditarConvencaoRequest = Partial<CriarConvencaoRequest>;

/** Farmácia inscrita numa convenção, como a sede vê (RF23). */
export interface InscricaoConvencao {
  associadoId: string;
  cnpj: string;
  razaoSocial: string;
  /** Data e hora ISO. */
  inscritaEm: string;
}
