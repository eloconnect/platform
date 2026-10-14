import { BadRequestException } from '@nestjs/common';

export interface AssociadoCsv {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string;
  municipio?: string;
  email?: string;
  telefone?: string;
}

const COLUNAS = new Set([
  'cnpj',
  'razaosocial',
  'nomefantasia',
  'municipio',
  'email',
  'telefone',
]);
export const MAXIMO_REGISTROS_CSV = 10000;
export const TAMANHO_MAXIMO_CSV = 15 * 1024 * 1024;

function normalizarColuna(coluna: string) {
  return coluna
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function detectarDelimitador(texto: string) {
  let virgulas = 0;
  let pontosEVirgulas = 0;
  let entreAspas = false;
  for (const caractere of texto.split(/\r?\n/, 1)[0] ?? '') {
    if (caractere === '"') entreAspas = !entreAspas;
    if (!entreAspas && caractere === ',') virgulas += 1;
    if (!entreAspas && caractere === ';') pontosEVirgulas += 1;
  }
  return pontosEVirgulas > virgulas ? ';' : ',';
}

interface EstadoLeituraCsv {
  linhas: string[][];
  linha: string[];
  campo: string;
  entreAspas: boolean;
  ignorarProximo: boolean;
}

function processarAspa(
  texto: string,
  indice: number,
  estado: EstadoLeituraCsv,
) {
  if (estado.entreAspas && texto[indice + 1] === '"') {
    estado.campo += '"';
    estado.ignorarProximo = true;
    return;
  }
  estado.entreAspas = !estado.entreAspas;
}

function processarCampo(
  texto: string,
  indice: number,
  caractere: string,
  delimitador: string,
  estado: EstadoLeituraCsv,
) {
  if (caractere === delimitador) {
    estado.linha.push(estado.campo);
    estado.campo = '';
    return;
  }
  if (caractere === '\n' || caractere === '\r') {
    if (caractere === '\r' && texto.charAt(indice + 1) === '\n') {
      estado.ignorarProximo = true;
    }
    finalizarLinha(estado);
    return;
  }
  estado.campo += caractere;
}

function processarCaractere(
  texto: string,
  indice: number,
  delimitador: string,
  estado: EstadoLeituraCsv,
) {
  if (estado.ignorarProximo) {
    estado.ignorarProximo = false;
    return;
  }
  const caractere = texto.charAt(indice);
  if (caractere === '"') {
    processarAspa(texto, indice, estado);
    return;
  }
  if (estado.entreAspas) {
    estado.campo += caractere;
    return;
  }
  processarCampo(texto, indice, caractere, delimitador, estado);
}

function finalizarLinha(estado: EstadoLeituraCsv) {
  estado.linha.push(estado.campo);
  estado.linhas.push(estado.linha);
  estado.linha = [];
  estado.campo = '';
}

function lerLinhas(texto: string, delimitador: string) {
  const estado: EstadoLeituraCsv = {
    linhas: [],
    linha: [],
    campo: '',
    entreAspas: false,
    ignorarProximo: false,
  };

  for (let indice = 0; indice < texto.length; indice += 1) {
    processarCaractere(texto, indice, delimitador, estado);
  }

  if (estado.entreAspas) {
    throw new BadRequestException(
      'O CSV contém um campo entre aspas incompleto.',
    );
  }
  if (estado.campo || estado.linha.length) {
    finalizarLinha(estado);
  }
  return estado.linhas;
}

export function lerAssociadosCsv(conteudo: Buffer): AssociadoCsv[] {
  const texto = conteudo.toString('utf8').replace(/^\uFEFF/, '');
  if (texto.includes('\uFFFD')) {
    throw new BadRequestException('O CSV precisa estar codificado em UTF-8.');
  }

  const delimitador = detectarDelimitador(texto);
  const linhas = lerLinhas(texto, delimitador).filter((linha) =>
    linha.some((campo) => campo.trim()),
  );
  const cabecalho = linhas.shift()?.map(normalizarColuna);
  if (!cabecalho?.length || cabecalho.some((coluna) => !COLUNAS.has(coluna))) {
    throw new BadRequestException(
      'Cabeçalho inválido. Use CNPJ, Razão Social e, opcionalmente, Nome Fantasia, Município, E-mail e Telefone.',
    );
  }
  if (new Set(cabecalho).size !== cabecalho.length) {
    throw new BadRequestException('O CSV contém colunas duplicadas.');
  }
  if (!cabecalho.includes('cnpj') || !cabecalho.includes('razaosocial')) {
    throw new BadRequestException(
      'As colunas CNPJ e Razão Social são obrigatórias.',
    );
  }

  const posicao = (nome: string) => cabecalho.indexOf(nome);
  const registros: AssociadoCsv[] = [];
  const cnpjs = new Set<string>();
  for (const [indice, linha] of linhas.entries()) {
    const numeroLinha = indice + 2;
    if (linha.length !== cabecalho.length) {
      throw new BadRequestException(
        `A linha ${numeroLinha} tem quantidade de campos diferente do cabeçalho.`,
      );
    }
    const cnpj = (linha[posicao('cnpj')] ?? '').replace(/\D/g, '');
    const razaoSocial = linha[posicao('razaosocial')]?.trim() ?? '';
    if (cnpj.length !== 14 || !razaoSocial) {
      throw new BadRequestException(
        `A linha ${numeroLinha} precisa ter CNPJ com 14 dígitos e Razão Social.`,
      );
    }
    if (cnpjs.has(cnpj)) {
      throw new BadRequestException(
        `O CNPJ da linha ${numeroLinha} aparece mais de uma vez no CSV.`,
      );
    }
    cnpjs.add(cnpj);

    const opcional = (nome: string) => {
      const indiceColuna = posicao(nome);
      const valor = indiceColuna < 0 ? '' : (linha[indiceColuna] ?? '').trim();
      return valor || undefined;
    };
    registros.push({
      cnpj,
      razaoSocial,
      nomeFantasia: opcional('nomefantasia'),
      municipio: opcional('municipio'),
      email: opcional('email'),
      telefone: opcional('telefone'),
    });
    if (registros.length > MAXIMO_REGISTROS_CSV) {
      throw new BadRequestException(
        `O CSV não pode conter mais de ${MAXIMO_REGISTROS_CSV} farmácias.`,
      );
    }
  }

  if (registros.length === 0) {
    throw new BadRequestException('O CSV não contém farmácias para importar.');
  }
  return registros;
}
