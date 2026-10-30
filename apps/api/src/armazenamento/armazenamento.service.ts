import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import type { ReadableStream } from 'node:stream/web';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { del, get, put } from '@vercel/blob';

/** Tipo de cada extensão: os PDFs das convenções e a imagem das notícias. */
const TIPO_POR_EXTENSAO: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

/** Prefixo do caminho dos arquivos guardados na pasta local. */
const LOCAL = 'local:';

/**
 * Guarda os PDFs das convenções e a imagem das notícias. Com o Vercel Blob
 * ligado ao projeto, eles ficam numa área privada, que só a API lê. Fora da
 * Vercel, sem o Blob (em desenvolvimento e nos testes), ficam na pasta
 * `ARQUIVOS_DIR`. O tipo do arquivo vem da extensão do nome.
 */
@Injectable()
export class ArmazenamentoService {
  constructor(private readonly config: ConfigService) {}

  /**
   * Armazena um arquivo privado e retorna somente seu caminho interno.
   * O caminho nunca deve ser enviado ao frontend.
   */
  async salvar(nomeArquivo: string, conteudo: Buffer): Promise<string> {
    if (this.usaBlob()) {
      const arquivo = await put(nomeArquivo, conteudo, {
        access: 'private',
        contentType: tipoDoArquivo(nomeArquivo),
        addRandomSuffix: true,
      });

      return arquivo.pathname;
    }

    const extensao = extname(nomeArquivo);
    const nome = `${nomeArquivo.slice(0, nomeArquivo.length - extensao.length)}-${randomUUID()}${extensao}`;
    const destino = this.naPasta(nome);
    await mkdir(dirname(destino), { recursive: true });
    await writeFile(destino, conteudo);

    return `${LOCAL}${nome}`;
  }

  /**
   * Recupera o conteúdo de um arquivo privado para a API transmiti-lo
   * após verificar as permissões do usuário.
   */
  async obter(
    caminho: string,
  ): Promise<{ stream: Readable; contentType: string } | null> {
    if (caminho.startsWith(LOCAL)) {
      const arquivo = this.naPasta(caminho.slice(LOCAL.length));

      try {
        await stat(arquivo);
      } catch {
        return null;
      }

      return {
        stream: createReadStream(arquivo),
        contentType: tipoDoArquivo(arquivo),
      };
    }

    this.exigirBlob();

    const arquivo = await get(caminho, { access: 'private' });

    if (!arquivo || arquivo.statusCode !== 200) {
      return null;
    }

    return {
      // O @vercel/blob tipa o stream com o ReadableStream global, que no Node
      // é o mesmo de node:stream/web; só os tipos do TypeScript divergem.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      stream: Readable.fromWeb(arquivo.stream as ReadableStream<Uint8Array>),
      contentType: arquivo.blob.contentType,
    };
  }

  /** Remove um arquivo privado pelo caminho interno. */
  async excluir(caminho: string): Promise<void> {
    if (caminho.startsWith(LOCAL)) {
      await rm(this.naPasta(caminho.slice(LOCAL.length)), { force: true });
      return;
    }

    this.exigirBlob();
    await del(caminho);
  }

  /**
   * Ao ligar o Blob ao projeto, a Vercel cria a `BLOB_STORE_ID` (Blob
   * privado, autenticado por OIDC) ou o `BLOB_READ_WRITE_TOKEN`. Na Vercel, a
   * pasta local não guarda os arquivos, então sem o Blob o envio para.
   */
  private usaBlob(): boolean {
    const configurado = Boolean(
      this.config.get<string>('BLOB_READ_WRITE_TOKEN') ||
      this.config.get<string>('BLOB_STORE_ID'),
    );

    if (!configurado && this.config.get<string>('VERCEL')) {
      throw new ServiceUnavailableException(
        'O armazenamento de arquivos não está configurado.',
      );
    }

    return configurado;
  }

  /** Arquivo do Blob precisa do Blob configurado. */
  private exigirBlob(): void {
    if (!this.usaBlob()) {
      throw new ServiceUnavailableException(
        'O armazenamento de arquivos não está configurado.',
      );
    }
  }

  /** Caminho dentro da pasta local, sem deixar sair dela. */
  private naPasta(nome: string): string {
    const pasta = resolve(
      this.config.get<string>('ARQUIVOS_DIR') ?? 'arquivos',
    );
    const arquivo = resolve(pasta, nome);

    if (!arquivo.startsWith(pasta + sep)) {
      throw new Error(`Caminho fora da pasta de arquivos: ${nome}`);
    }

    return arquivo;
  }
}

function tipoDoArquivo(nome: string): string {
  return (
    TIPO_POR_EXTENSAO[extname(nome).toLowerCase()] ?? 'application/octet-stream'
  );
}

/**
 * Só o nome do arquivo enviado, sem pastas nem caracteres de controle, para o
 * log de auditoria. Sem nome, fica o `padrao`.
 */
export function nomeOriginal(nome: string, padrao: string): string {
  const limpo = (nome.split(/[\\/]/).pop() ?? '')
    .replace(/\p{Cc}/gu, '')
    .trim();
  return limpo ? limpo.slice(-200) : padrao;
}
