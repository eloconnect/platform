import {
  cnpjValido,
  normalizarCnpj,
  type ErroJucemat,
} from '@eloconnect/shared';

/** Até quantas empresas um arquivo traz. */
export const MAXIMO_EMPRESAS = 10000;

/** Uma empresa lida do arquivo, pronta para o cadastro. */
export interface EmpresaJucemat {
  empresa: number;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  email: string | null;
  telefone: string | null;
  municipio: string | null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Texto do arquivo, no encoding que o próprio XML declara (UTF-8 ou
 * ISO-8859-1/Windows-1252, comum em sistemas de governo).
 */
export function textoDoXml(arquivo: Buffer): string {
  const prologo = arquivo.subarray(0, 200).toString('latin1');
  const latin1 = /encoding=["'](iso-8859-1|windows-1252|latin1)["']/i.test(
    prologo,
  );
  return arquivo.toString(latin1 ? 'latin1' : 'utf8').replace(/^﻿/, '');
}

/** Troca as entidades do XML pelos caracteres. */
function decodificar(texto: string): string {
  return texto
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

function campo(bloco: string, nome: string): string {
  const achado = new RegExp(`<${nome}>([\\s\\S]*?)</${nome}>`, 'i').exec(bloco);
  return achado ? decodificar(achado[1]) : '';
}

/**
 * Lê o XML no layout provisório (exemploXmlJucemat, no shared): uma
 * `<empresa>` por farmácia, com `cnpj`, `razaoSocial`, `nomeFantasia`,
 * `email`, `telefone` e `municipio`. TODO(P02): trocar pela leitura do
 * layout real quando a JUCEMAT mandar um exemplo.
 */
export function lerXmlJucemat(texto: string): {
  empresas: EmpresaJucemat[];
  erros: ErroJucemat[];
} {
  const blocos = texto.match(/<empresa>[\s\S]*?<\/empresa>/gi) ?? [];
  if (blocos.length === 0) {
    return {
      empresas: [],
      erros: [
        {
          empresa: 0,
          mensagem:
            'O arquivo não tem nenhuma <empresa>. Confira se é o XML da JUCEMAT.',
        },
      ],
    };
  }
  if (blocos.length > MAXIMO_EMPRESAS) {
    return {
      empresas: [],
      erros: [
        {
          empresa: 0,
          mensagem: `O arquivo passa de ${MAXIMO_EMPRESAS} empresas. Divida em mais de um arquivo.`,
        },
      ],
    };
  }

  const empresas: EmpresaJucemat[] = [];
  const erros: ErroJucemat[] = [];
  const vistos = new Set<string>();
  blocos.forEach((bloco, i) => {
    const empresa = i + 1;
    const cnpj = campo(bloco, 'cnpj');
    const razaoSocial = campo(bloco, 'razaoSocial');
    const email = campo(bloco, 'email');
    const problemas: string[] = [];
    if (!cnpjValido(cnpj)) {
      problemas.push(cnpj ? 'CNPJ inválido.' : 'Falta o CNPJ.');
    } else if (vistos.has(normalizarCnpj(cnpj))) {
      problemas.push('CNPJ repetido no arquivo.');
    }
    if (!razaoSocial) problemas.push('Falta a razão social.');
    if (email && !EMAIL.test(email)) problemas.push('E-mail inválido.');
    if (problemas.length > 0) {
      erros.push({ empresa, mensagem: problemas.join(' ') });
      return;
    }
    vistos.add(normalizarCnpj(cnpj));
    empresas.push({
      empresa,
      cnpj: normalizarCnpj(cnpj),
      razaoSocial,
      nomeFantasia: campo(bloco, 'nomeFantasia') || null,
      email: email || null,
      telefone: campo(bloco, 'telefone') || null,
      municipio: campo(bloco, 'municipio') || null,
    });
  });
  return { empresas, erros };
}
