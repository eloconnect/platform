// Página A4, em pontos.
export const LARGURA = 595;
export const ALTURA = 842;
export const MARGEM = 50;

/** F1: Helvetica, F2: Helvetica em negrito, F3: Courier. */
export type Fonte = 'F1' | 'F2' | 'F3';

/** Comando que escreve uma linha de texto com a base em (x, y). */
export function texto(
  x: number,
  y: number,
  conteudo: string,
  tamanho = 12,
  fonte: Fonte = 'F1',
): string {
  return `BT /${fonte} ${tamanho} Tf ${x} ${y} Td (${textoPdf(conteudo)}) Tj ET`;
}

/**
 * Texto entre parênteses do PDF. As fontes padrão usam o Latin-1: o que fica
 * fora dele vira "?".
 */
function textoPdf(conteudo: string): string {
  return Array.from(conteudo, (caractere) =>
    caractere.charCodeAt(0) > 0xff ? '?' : caractere,
  )
    .join('')
    .replace(/[\\()]/g, (caractere) => `\\${caractere}`);
}

/** Fonte padrão do PDF, que todo leitor tem. */
function fontePadrao(nome: string): string {
  return `<< /Type /Font /Subtype /Type1 /BaseFont /${nome} /Encoding /WinAnsiEncoding >>`;
}

/**
 * Monta o arquivo à mão, sem biblioteca: catálogo, páginas, fontes, o
 * conteúdo de cada página e a tabela xref.
 */
export function montarPdf(paginas: string[]): Buffer {
  // Objetos 1 a 5: catálogo, lista de páginas e as três fontes. Depois, cada
  // página e o conteúdo dela.
  const primeiraPagina = 6;
  const kids = paginas.map((_, i) => `${primeiraPagina + 2 * i} 0 R`);
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${paginas.length} >>`,
    fontePadrao('Helvetica'),
    fontePadrao('Helvetica-Bold'),
    fontePadrao('Courier'),
    ...paginas.flatMap((conteudo, i) => [
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${LARGURA} ${ALTURA}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${primeiraPagina + 2 * i + 1} 0 R >>`,
      `<< /Length ${Buffer.byteLength(conteudo, 'latin1')} >>\nstream\n${conteudo}\nendstream`,
    ]),
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
