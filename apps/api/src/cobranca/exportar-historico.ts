import type { BoletoHistorico } from '@eloconnect/shared';
import {
  formatarCnpj,
  formatarDia,
  formatarReais,
  textoMesBoleto,
  textoSituacaoBoleto,
} from '@eloconnect/shared';
import { ALTURA, LARGURA, MARGEM, montarPdf, texto } from './pdf.js';

/** Associado e boletos que vão no arquivo exportado. */
export interface DadosExportacao {
  razaoSocial: string;
  cnpj: string;
  emitidoEm: Date;
  boletos: BoletoHistorico[];
}

/** Início de cada coluna da tabela, em pontos. */
const COLUNAS = [MARGEM, 225, 300, 375];
const TITULOS = ['Mês', 'Valor', 'Vencimento', 'Situação'];
const TAMANHO = 11;
const LINHA = 18;
/** Abaixo disto fica só o número da página. */
const FIM_DA_PAGINA = MARGEM + 20;

/** As colunas de um boleto, com o mesmo texto da tela (RF07, RF31). */
function celulas(boleto: BoletoHistorico): string[] {
  return [
    textoMesBoleto(boleto),
    formatarReais(boleto.valor),
    formatarDia(boleto.vencimento),
    textoSituacaoBoleto(boleto),
  ];
}

/**
 * Histórico do associado em PDF, para a sede mandar como comprovante de
 * contribuição ou de não contribuição (US32: RF32). Uma tabela com os
 * boletos, do mais novo para o mais antigo, que continua nas páginas
 * seguintes com o cabeçalho repetido.
 */
export function pdfHistorico(dados: DadosExportacao): Buffer {
  const paginas: string[][] = [];
  let comandos: string[] = [];
  let y = ALTURA - MARGEM;

  const cabecalhoDaTabela = () => {
    y -= LINHA;
    TITULOS.forEach((titulo, i) =>
      comandos.push(texto(COLUNAS[i], y, titulo, TAMANHO, 'F2')),
    );
    comandos.push(
      `0.5 w ${MARGEM} ${y - 5} m ${LARGURA - MARGEM} ${y - 5} l S`,
    );
    y -= 4;
  };

  y -= 27;
  comandos.push(texto(MARGEM, y, 'Histórico de pagamentos', 18, 'F2'));
  y -= 20;
  comandos.push(texto(MARGEM, y, dados.razaoSocial, 12, 'F2'));
  y -= 18;
  comandos.push(texto(MARGEM, y, `CNPJ: ${formatarCnpj(dados.cnpj)}`));
  y -= 18;
  comandos.push(
    texto(
      MARGEM,
      y,
      `Emitido pelo Elo Connect em ${emitidoEm(dados.emitidoEm)}.`,
      10,
    ),
  );
  y -= 12;

  if (dados.boletos.length === 0) {
    y -= LINHA;
    comandos.push(
      texto(MARGEM, y, 'Nenhum boleto até a data de emissão.', TAMANHO),
    );
  } else {
    cabecalhoDaTabela();
  }

  for (const boleto of dados.boletos) {
    if (y - LINHA < FIM_DA_PAGINA) {
      paginas.push(comandos);
      comandos = [];
      y = ALTURA - MARGEM - 12;
      comandos.push(
        texto(MARGEM, y, `Histórico de pagamentos: ${dados.razaoSocial}`, 10),
      );
      y -= 8;
      cabecalhoDaTabela();
    }
    y -= LINHA;
    celulas(boleto).forEach((celula, i) =>
      comandos.push(texto(COLUNAS[i], y, celula, TAMANHO)),
    );
  }
  paginas.push(comandos);

  return montarPdf(
    paginas.map((pagina, i) =>
      [
        ...pagina,
        texto(MARGEM, MARGEM - 20, `Página ${i + 1} de ${paginas.length}`, 9),
      ].join('\n'),
    ),
  );
}

/**
 * Histórico do associado em CSV, para abrir numa planilha (US32: RF32). Usa
 * ";" e vírgula decimal, como o Excel em português espera, e começa com o BOM
 * para os acentos aparecerem certos.
 */
export function csvHistorico(boletos: BoletoHistorico[]): Buffer {
  const linhas = [
    ['Mês', 'Valor (R$)', 'Vencimento', 'Situação'],
    ...boletos.map((boleto) => {
      const [mes, , vencimento, situacao] = celulas(boleto);
      return [mes, boleto.valor.replace('.', ','), vencimento, situacao];
    }),
  ];
  const conteudo = linhas
    .map((linha) => linha.map(celulaCsv).join(';'))
    .join('\r\n');
  return Buffer.from(`\uFEFF${conteudo}\r\n`, 'utf8');
}

/** Entre aspas quando o valor tem ";", aspas ou quebra de linha. */
function celulaCsv(valor: string): string {
  return /[";\r\n]/.test(valor) ? `"${valor.replaceAll('"', '""')}"` : valor;
}

/** "02/11/2026 às 17:05 (horário de Mato Grosso)". */
function emitidoEm(data: Date): string {
  const fuso = { timeZone: 'America/Cuiaba' };
  const dia = data.toLocaleDateString('pt-BR', fuso);
  const hora = data.toLocaleTimeString('pt-BR', {
    ...fuso,
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${dia} às ${hora} (horário de Mato Grosso)`;
}
