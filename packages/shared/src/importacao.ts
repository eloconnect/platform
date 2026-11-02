/** Colunas da planilha modelo da carga inicial dos associados (RF42). */
export const COLUNAS_IMPORTACAO = [
  'CNPJ',
  'Razão social',
  'Nome fantasia',
  'E-mail',
  'Telefone',
  'Município',
  'Recebe boleto mensal',
] as const;

/**
 * Planilha modelo em CSV, só com o cabeçalho, para a sede preencher. Usa ";"
 * e começa com o BOM, como o Excel em português espera.
 */
export function planilhaModelo(): string {
  return `\uFEFF${COLUNAS_IMPORTACAO.join(';')}\r\n`;
}

/** Uma linha da planilha com problema, contando o cabeçalho como linha 1. */
export interface ErroImportacao {
  linha: number;
  mensagem: string;
}

/**
 * Resultado da importação (RF42). Com algum erro, nada é importado, e a sede
 * corrige a planilha e envia de novo.
 */
export interface ResultadoImportacao {
  importados: number;
  /** Dos importados, os que recebem o boleto mensal. */
  recebemBoleto: number;
  erros: ErroImportacao[];
}
