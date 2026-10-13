import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  NotFoundException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';

export const TAMANHO_MAXIMO_PDF = 15 * 1024 * 1024;

function pastaAnexos() {
  return resolve(
    process.env['UPLOADS_DIR'] ?? join(process.cwd(), 'uploads', 'convencoes'),
  );
}

export async function salvarPdf(buffer: Buffer): Promise<string> {
  if (buffer.length < 5 || buffer.subarray(0, 5).toString() !== '%PDF-') {
    throw new UnsupportedMediaTypeException('O arquivo enviado não é um PDF.');
  }
  const nome = `${randomUUID()}.pdf`;
  await mkdir(pastaAnexos(), { recursive: true });
  await writeFile(join(pastaAnexos(), nome), buffer, { flag: 'wx' });
  return nome;
}

export async function lerPdf(nome: string): Promise<Buffer> {
  if (!/^[\da-f-]{36}\.pdf$/i.test(nome)) {
    throw new NotFoundException('Anexo não encontrado.');
  }
  try {
    return await readFile(join(pastaAnexos(), nome));
  } catch (erro) {
    if (
      typeof erro === 'object' &&
      erro !== null &&
      'code' in erro &&
      erro.code === 'ENOENT'
    ) {
      throw new NotFoundException('Anexo não encontrado.');
    }
    throw erro;
  }
}

export async function removerPdf(nome: string): Promise<void> {
  if (!/^[\da-f-]{36}\.pdf$/i.test(nome)) {
    throw new Error('Nome de arquivo de convenção inválido.');
  }
  await unlink(join(pastaAnexos(), nome));
}
