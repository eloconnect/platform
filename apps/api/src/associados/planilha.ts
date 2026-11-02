import {
  cnpjValido,
  COLUNAS_IMPORTACAO,
  normalizarCnpj,
  type ErroImportacao,
} from '@eloconnect/shared';

/** Até quantas farmácias uma planilha traz (cerca de 2.000 em MT). */
export const MAXIMO_LINHAS = 5000;

/** Um associado lido da planilha, pronto para o cadastro. */
export interface LinhaImportacao {
  linha: number;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  email: string | null;
  telefone: string | null;
  municipio: string | null;
  contribuicaoAtiva: boolean;
}

/**
 * Texto do arquivo enviado. O Excel salva o "CSV UTF-8" em UTF-8 e o "CSV
 * (separado por vírgulas)" em Windows-1252: se o UTF-8 não fecha, o arquivo é
 * lido do segundo jeito, para os acentos chegarem certos.
 */
export function textoDoArquivo(arquivo: Buffer): string {
  const utf8 = arquivo.toString('utf8');
  return utf8.includes('�') ? arquivo.toString('latin1') : utf8;
}

/** Separa as linhas e as colunas, com campos entre aspas, como o Excel faz. */
function lerCsv(texto: string): string[][] {
  const conteudo = texto.replace(/^\uFEFF/, '');
  const fimDaPrimeira = conteudo.search(/\r|\n/);
  const cabecalho =
    fimDaPrimeira < 0 ? conteudo : conteudo.slice(0, fimDaPrimeira);
  const separador = cabecalho.includes(';') ? ';' : ',';

  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = '';
  let entreAspas = false;
  for (let i = 0; i < conteudo.length; i++) {
    const caractere = conteudo[i];
    if (entreAspas) {
      if (caractere === '"' && conteudo[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (caractere === '"') {
        entreAspas = false;
      } else {
        campo += caractere;
      }
    } else if (caractere === '"') {
      entreAspas = true;
    } else if (caractere === separador) {
      linha.push(campo);
      campo = '';
    } else if (caractere === '\r' || caractere === '\n') {
      if (caractere === '\r' && conteudo[i + 1] === '\n') i++;
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = '';
    } else {
      campo += caractere;
    }
  }
  if (campo !== '' || linha.length > 0) {
    linha.push(campo);
    linhas.push(linha);
  }
  return linhas;
}

/** Para comparar o cabeçalho sem ligar para acento, caixa e espaços. */
function simplificar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Lê a planilha modelo preenchida pela sede (RF42) e confere cada linha: o
 * CNPJ válido e sem repetição, a razão social, o e-mail e o "Recebe boleto
 * mensal". As linhas vazias ficam de fora.
 */
export function lerPlanilha(texto: string): {
  linhas: LinhaImportacao[];
  erros: ErroImportacao[];
} {
  const [cabecalho, ...resto] = lerCsv(texto);
  const esperado = COLUNAS_IMPORTACAO.map(simplificar);
  if (
    !cabecalho ||
    esperado.some((coluna, i) => simplificar(cabecalho[i] ?? '') !== coluna)
  ) {
    return {
      linhas: [],
      erros: [
        {
          linha: 1,
          mensagem: `A primeira linha precisa ser o cabeçalho da planilha modelo: ${COLUNAS_IMPORTACAO.join(', ')}.`,
        },
      ],
    };
  }

  const preenchidas = resto
    .map((campos, i) => ({ campos: campos.map((c) => c.trim()), linha: i + 2 }))
    .filter(({ campos }) => campos.some((campo) => campo !== ''));
  if (preenchidas.length === 0) {
    return {
      linhas: [],
      erros: [{ linha: 2, mensagem: 'A planilha não tem nenhuma farmácia.' }],
    };
  }
  if (preenchidas.length > MAXIMO_LINHAS) {
    return {
      linhas: [],
      erros: [
        {
          linha: MAXIMO_LINHAS + 2,
          mensagem: `A planilha passa de ${MAXIMO_LINHAS} farmácias. Divida em mais de um arquivo.`,
        },
      ],
    };
  }

  const linhas: LinhaImportacao[] = [];
  const erros: ErroImportacao[] = [];
  const primeiraLinhaDoCnpj = new Map<string, number>();
  for (const { campos, linha } of preenchidas) {
    const [
      cnpj = '',
      razaoSocial = '',
      nomeFantasia,
      email,
      telefone,
      municipio,
      recebe = '',
    ] = campos;
    const problemas: string[] = [];
    const cnpjNormalizado = normalizarCnpj(cnpj);
    if (!cnpjValido(cnpj)) {
      problemas.push(cnpj ? 'CNPJ inválido.' : 'Falta o CNPJ.');
    } else if (primeiraLinhaDoCnpj.has(cnpjNormalizado)) {
      problemas.push(
        `CNPJ repetido: já está na linha ${primeiraLinhaDoCnpj.get(cnpjNormalizado)}.`,
      );
    } else {
      primeiraLinhaDoCnpj.set(cnpjNormalizado, linha);
    }
    if (!razaoSocial) problemas.push('Falta a razão social.');
    if (email && !EMAIL.test(email)) problemas.push('E-mail inválido.');
    const resposta = simplificar(recebe);
    if (!['', 'sim', 's', 'nao', 'n'].includes(resposta)) {
      problemas.push('Em "Recebe boleto mensal", escreva sim ou não.');
    }

    if (problemas.length > 0) {
      erros.push({ linha, mensagem: problemas.join(' ') });
      continue;
    }
    linhas.push({
      linha,
      cnpj: cnpjNormalizado,
      razaoSocial,
      nomeFantasia: nomeFantasia || null,
      email: email || null,
      telefone: telefone || null,
      municipio: municipio || null,
      contribuicaoAtiva: resposta === 'sim' || resposta === 's',
    });
  }
  return { linhas, erros };
}
