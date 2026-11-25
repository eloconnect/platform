/**
 * Importação do arquivo da JUCEMAT (US28: RF28). O layout real depende da
 * P02; até ele chegar, o grupo decidiu, com aval do cliente (24/11/2026), um
 * XML simples, documentado aqui e em docs/decisoes-tecnicas.md. Quando o
 * arquivo real chegar, só a leitura (apps/api/src/associados/jucemat.ts)
 * muda.
 */

/** Exemplo do layout, só com dados fictícios, para a sede conferir. */
export function exemploXmlJucemat(): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<empresas>',
    '  <empresa>',
    '    <cnpj>11.222.333/0001-81</cnpj>',
    '    <razaoSocial>Farmácia Exemplo Ltda</razaoSocial>',
    '    <nomeFantasia>Farmácia Exemplo</nomeFantasia>',
    '    <email>contato@example.com</email>',
    '    <telefone>(65) 3000-0000</telefone>',
    '    <municipio>Cuiabá</municipio>',
    '  </empresa>',
    '</empresas>',
    '',
  ].join('\n');
}

/** Uma empresa do arquivo com problema, contando a partir de 1. */
export interface ErroJucemat {
  empresa: number;
  mensagem: string;
}

/**
 * Resultado da importação. Diferente da planilha, não é tudo ou nada: o
 * arquivo vem da JUCEMAT, e a empresa com problema fica de fora sozinha.
 */
export interface ResultadoJucemat {
  /** Farmácias novas no cadastro, sem receber o boleto mensal. */
  novas: number;
  /** Farmácias que já estavam e ganharam dados que faltavam. */
  completadas: number;
  /** Farmácias que já estavam completas. */
  semMudanca: number;
  erros: ErroJucemat[];
}
