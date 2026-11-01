import { formatarCnpj, formatarReais } from '@eloconnect/shared';
import type { BoletoEmitido, PedidoBoleto } from './gateway-pagamento.js';
import { qrCodePix } from './qr-code-pix.js';

// Página A4, em pontos.
const LARGURA = 595;
const ALTURA = 842;
const MARGEM = 50;
/** Lado de cada quadrado do QR Code, em pontos. */
const MODULO = 4;

/** F1: Helvetica, F2: Helvetica em negrito, F3: Courier. */
type Fonte = 'F1' | 'F2' | 'F3';

/**
 * PDF do boleto do banco simulado: uma página com os dados do boleto, o QR
 * Code do Pix e o aviso de que nenhum banco aceita o boleto. É montado à mão,
 * sem biblioteca, porque só serve à simulação: o PDF de verdade vem do banco.
 */
export function pdfSimulado(boleto: PedidoBoleto & BoletoEmitido): Buffer {
  const comandos: string[] = [];
  let y = ALTURA - MARGEM;
  const escrever = (texto: string, tamanho = 12, fonte: Fonte = 'F1') => {
    y -= tamanho * 1.5;
    comandos.push(
      `BT /${fonte} ${tamanho} Tf ${MARGEM} ${y} Td (${textoPdf(texto)}) Tj ET`,
    );
  };

  escrever('BOLETO SIMULADO - NÃO PAGUE', 18, 'F2');
  escrever('Feito pelo banco simulado do Elo Connect, só para testes.');
  escrever('Nenhum banco aceita este boleto.');
  y -= 12;
  escrever(`Pagador: ${boleto.pagador.nome}`);
  escrever(`CNPJ: ${formatarCnpj(boleto.pagador.cnpj)}`);
  y -= 12;
  escrever(`Valor: ${formatarReais(boleto.valor.toFixed(2))}`, 14, 'F2');
  escrever(`Vencimento: ${dia(boleto.vencimento)}`, 14, 'F2');
  escrever(`Pague até: ${dia(boleto.validoAte)}`);
  escrever(`Nosso número: ${boleto.nossoNumero}`);
  y -= 12;
  escrever('Linha digitável', 12, 'F2');
  escrever(boleto.linhaDigitavel, 11, 'F3');
  y -= 12;
  escrever('Pix', 12, 'F2');

  // Um quadrado preto para cada módulo escuro do QR Code.
  const qr = qrCodePix(boleto.pixCopiaECola);
  const modulos = qr.getModuleCount();
  y -= 12 + modulos * MODULO;
  for (let linha = 0; linha < modulos; linha++) {
    for (let coluna = 0; coluna < modulos; coluna++) {
      if (qr.isDark(linha, coluna)) {
        const x = MARGEM + coluna * MODULO;
        const base = y + (modulos - 1 - linha) * MODULO;
        comandos.push(`${x} ${base} ${MODULO} ${MODULO} re`);
      }
    }
  }
  comandos.push('f');

  y -= 6;
  escrever('Pix Copia e Cola', 12, 'F2');
  for (const parte of boleto.pixCopiaECola.match(/.{1,80}/g) ?? []) {
    escrever(parte, 9, 'F3');
  }
  return montarPdf(comandos.join('\n'));
}

/** As datas do boleto são dias, guardados à meia-noite UTC. */
function dia(data: Date): string {
  return data.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

/**
 * Texto entre parênteses do PDF. As fontes padrão usam o Latin-1: o que fica
 * fora dele vira "?".
 */
function textoPdf(texto: string): string {
  return Array.from(texto, (caractere) =>
    caractere.charCodeAt(0) > 0xff ? '?' : caractere,
  )
    .join('')
    .replace(/[\\()]/g, (caractere) => `\\${caractere}`);
}

/** Fonte padrão do PDF, que todo leitor tem. */
function fontePadrao(nome: string): string {
  return `<< /Type /Font /Subtype /Type1 /BaseFont /${nome} /Encoding /WinAnsiEncoding >>`;
}

/** Monta o arquivo: catálogo, página, fontes, conteúdo e a tabela xref. */
function montarPdf(conteudo: string): Buffer {
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${LARGURA} ${ALTURA}] /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R >> >> /Contents 7 0 R >>`,
    fontePadrao('Helvetica'),
    fontePadrao('Helvetica-Bold'),
    fontePadrao('Courier'),
    `<< /Length ${Buffer.byteLength(conteudo, 'latin1')} >>\nstream\n${conteudo}\nendstream`,
  ];

  let pdf = '%PDF-1.4\n';
  const posicoes: number[] = [];
  objetos.forEach((objeto, indice) => {
    posicoes.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${indice + 1} 0 obj\n${objeto}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  for (const posicao of posicoes) {
    pdf += `${String(posicao).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}
