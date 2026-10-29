import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { del, get, put } from '@vercel/blob';

const TIPO_CONTEUDO_PDF = 'application/pdf';

@Injectable()
export class ArmazenamentoConvencoesService {
  constructor(private readonly config: ConfigService) {}

  /**
   * Armazena um PDF privado e retorna somente seu caminho interno.
   * O caminho nunca deve ser enviado ao frontend.
   */
  async salvar(nomeArquivo: string, conteudo: Buffer): Promise<string> {
    this.exigirToken();

    const arquivo = await put(nomeArquivo, conteudo, {
      access: 'private',
      contentType: TIPO_CONTEUDO_PDF,
      addRandomSuffix: true,
    });

    return arquivo.pathname;
  }

  /**
   * Recupera o conteúdo de um PDF privado para a API transmiti-lo
   * após verificar as permissões do usuário.
   */
  async obter(caminho: string): Promise<{
    stream: ReadableStream<Uint8Array>;
    contentType: string;
  } | null> {
    this.exigirToken();

    const arquivo = await get(caminho, {
      access: 'private',
      useCache: false,
    });

    if (!arquivo || arquivo.statusCode !== 200) {
      return null;
    }

    return {
      stream: arquivo.stream,
      contentType: arquivo.blob.contentType,
    };
  }

  /** Remove um arquivo privado pelo caminho interno. */
  async excluir(caminho: string): Promise<void> {
    this.exigirToken();
    await del(caminho);
  }

  private exigirToken(): void {
    if (!this.config.get<string>('BLOB_READ_WRITE_TOKEN')) {
      throw new ServiceUnavailableException(
        'O armazenamento de PDFs não está configurado.',
      );
    }
  }
}
