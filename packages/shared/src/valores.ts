/** Desconto do plano anual à vista, em porcentagem (RN13). */
export const DESCONTO_PLANO_ANUAL = 20;

/**
 * Valor mensal em reais com ponto e duas casas, como a API recebe (ex.:
 * "130.50"). Até 999.999,99, para o anual caber no banco (Decimal(10, 2)).
 */
export const FORMATO_VALOR = /^\d{1,6}\.\d{2}$/;

/**
 * Lê o valor digitado pela sede: "130", "130,5", "130,50" ou "R$ 130,50".
 * Devolve no formato da API ("130.50"), ou null se não for um valor em reais.
 * Não aceita separador de milhar.
 */
export function lerValorEmReais(texto: string): string | null {
  const limpo = texto.replace(/R\$/i, '').replace(/\s/g, '');
  const partes = /^(\d{1,6})(?:[,.](\d{1,2}))?$/.exec(limpo);
  if (!partes) return null;
  const [, reais, centavos = ''] = partes;
  return `${Number(reais)}.${centavos.padEnd(2, '0')}`;
}

/**
 * Valor do plano anual à vista: 12 meses com 20% de desconto (RN13), em
 * centavos inteiros e arredondado para o centavo mais próximo.
 * TODO(P23): o cliente ainda não confirmou que o anual é calculado assim.
 */
export function calcularValorAnual(valorMensal: string): string {
  const doze = paraCentavos(valorMensal) * 12;
  return deCentavos(Math.round((doze * (100 - DESCONTO_PLANO_ANUAL)) / 100));
}

/** "1152.00" vira "R$ 1.152,00". */
export function formatarReais(valor: string): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(paraCentavos(valor) / 100);
}

/** Mês de um boleto (competência). `mes` vai de 1 a 12. */
export interface Competencia {
  ano: number;
  mes: number;
}

/** Mato Grosso não tem horário de verão desde 2019: o fuso é sempre -04:00. */
export const FUSO_SEDE_HORAS = -4;

/**
 * Primeiro boleto que usa um valor alterado em `data`: o do mês seguinte ao
 * da alteração, no horário de Mato Grosso (RN15).
 */
export function competenciaDoNovoValor(data: Date): Competencia {
  const local = new Date(data.getTime() + FUSO_SEDE_HORAS * 60 * 60 * 1000);
  const ano = local.getUTCFullYear();
  const mes = local.getUTCMonth() + 1;
  return mes === 12 ? { ano: ano + 1, mes: 1 } : { ano, mes: mes + 1 };
}

/** { ano: 2026, mes: 11 } vira "novembro de 2026". */
export function textoCompetencia({ ano, mes }: Competencia): string {
  return new Date(Date.UTC(ano, mes - 1, 1)).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function paraCentavos(valor: string): number {
  const [reais, centavos = '0'] = valor.split('.');
  return Number(reais) * 100 + Number(centavos.padEnd(2, '0').slice(0, 2));
}

function deCentavos(centavos: number): string {
  return `${Math.floor(centavos / 100)}.${String(centavos % 100).padStart(2, '0')}`;
}

/** Um valor da contribuição, como a API devolve (RF18, RF20). */
export interface ValorContribuicao {
  id: string;
  /** Em reais, com ponto e duas casas (ex.: "130.00"). */
  valorMensal: string;
  /** Calculado a partir do mensal (`calcularValorAnual`). */
  valorAnual: string;
  /** Data e hora da alteração, em texto ISO. */
  alteradoEm: string;
  alteradoPor: { nome: string };
}

/** Painel de valores da sede (RF18 a RF20). */
export interface PainelValores {
  /** O valor mais recente; nulo enquanto a sede não cadastrou nenhum. */
  atual: ValorContribuicao | null;
  /** Todas as alterações, da mais recente para a mais antiga. */
  historico: ValorContribuicao[];
  /** Quantos associados recebem o aviso por e-mail ao alterar (RN15). */
  associadosAvisados: number;
}

/** Novo valor mensal; o anual é calculado pela API. */
export interface AlterarValorRequest {
  /** Em reais, com ponto e duas casas (ex.: "130.00"). */
  valorMensal: string;
}
