import type { Readable } from 'node:stream';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Noticia } from '@eloconnect/shared';
import {
  ArmazenamentoService,
  nomeOriginal,
} from '../armazenamento/armazenamento.service.js';
import {
  AuditoriaService,
  diferencas,
} from '../auditoria/auditoria.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  EditarNoticiaDto,
  PublicarNoticiaDto,
} from './dto/noticia.dto.js';

const CAMPOS = {
  id: true,
  titulo: true,
  conteudo: true,
  publicadaEm: true,
  imagemCaminho: true,
  imagemDescricao: true,
} satisfies Prisma.NoticiaSelect;

/** Publicada e não removida: é o que aparece no feed. */
const NO_FEED = {
  publicadaEm: { not: null },
  removidaEm: null,
} satisfies Prisma.NoticiaWhereInput;

const ENTIDADE = 'Noticia';

/** Imagem enviada pela sede, como o multer entrega. */
export interface ArquivoImagem {
  buffer: Buffer;
  originalname: string;
}

/**
 * Feed de notícias (RF35, RN28) e publicação pela sede (RF41). A notícia sai
 * no feed assim que é publicada; a data é a da publicação. Cada notícia pode
 * ter uma imagem, opcional, guardada numa área privada.
 */
@Injectable()
export class NoticiasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly armazenamento: ArmazenamentoService,
  ) {}

  /** Da mais recente para a mais antiga. */
  async listar(): Promise<Noticia[]> {
    const noticias = await this.prisma.noticia.findMany({
      where: NO_FEED,
      orderBy: [{ publicadaEm: 'desc' }, { id: 'desc' }],
      select: CAMPOS,
    });
    return noticias.map(paraNoticia);
  }

  async publicar(
    usuarioId: string,
    { titulo, conteudo }: PublicarNoticiaDto,
  ): Promise<Noticia> {
    return this.prisma.$transaction(async (tx) => {
      const noticia = await tx.noticia.create({
        data: { titulo, conteudo, publicadaEm: new Date(), autorId: usuarioId },
        select: CAMPOS,
      });
      await this.auditoria.registrar(tx, {
        usuarioId,
        acao: 'NOTICIA_PUBLICADA',
        entidade: ENTIDADE,
        entidadeId: noticia.id,
        valorNovo: { titulo, conteudo },
      });
      return paraNoticia(noticia);
    });
  }

  async editar(
    usuarioId: string,
    id: string,
    { titulo, conteudo }: EditarNoticiaDto,
  ): Promise<Noticia> {
    // Campo não enviado fica undefined: não muda nem entra no log.
    const dados = { titulo, conteudo };
    return this.prisma.$transaction(async (tx) => {
      const antes = await this.buscarNoFeed(tx, id);
      const noticia = await tx.noticia.update({
        where: { id },
        data: dados,
        select: CAMPOS,
      });
      const mudanca = diferencas(antes, dados);
      if (mudanca) {
        await this.auditoria.registrar(tx, {
          usuarioId,
          acao: 'NOTICIA_EDITADA',
          entidade: ENTIDADE,
          entidadeId: id,
          ...mudanca,
        });
      }
      return paraNoticia(noticia);
    });
  }

  /** Tira a notícia do feed; o registro fica para o log. */
  async remover(usuarioId: string, id: string): Promise<Noticia> {
    return this.prisma.$transaction(async (tx) => {
      await this.buscarNoFeed(tx, id);
      const noticia = await tx.noticia.update({
        where: { id },
        data: { removidaEm: new Date() },
        select: CAMPOS,
      });
      await this.auditoria.registrar(tx, {
        usuarioId,
        acao: 'NOTICIA_REMOVIDA',
        entidade: ENTIDADE,
        entidadeId: id,
      });
      return paraNoticia(noticia);
    });
  }

  /**
   * Põe ou troca a imagem da notícia, ou só muda a descrição dela. Sem o
   * arquivo, a notícia precisa já ter imagem. A descrição não enviada não
   * muda, e a vazia é tirada.
   */
  async definirImagem(
    usuarioId: string,
    id: string,
    arquivo: ArquivoImagem | undefined,
    descricao: string | undefined,
  ): Promise<Noticia> {
    const extensao = arquivo ? extensaoDaImagem(arquivo.buffer) : undefined;
    if (extensao === null) {
      throw new BadRequestException('Envie uma imagem JPG, PNG ou WebP.');
    }
    // Confere a notícia antes de gravar o arquivo.
    if (arquivo) await this.buscarNoFeed(this.prisma, id);

    const nome = arquivo && nomeOriginal(arquivo.originalname, 'imagem');
    const caminho =
      arquivo &&
      (await this.armazenamento.salvar(
        `noticias/${id}/imagem${extensao}`,
        arquivo.buffer,
      ));
    const dados = {
      imagemCaminho: caminho,
      imagemNome: nome,
      imagemDescricao: descricao === undefined ? undefined : descricao || null,
    };

    let resultado: { noticia: Noticia; caminhoAntigo: string | null };
    try {
      resultado = await this.prisma.$transaction(async (tx) => {
        const antes = await this.buscarNoFeed(tx, id);
        if (!caminho && !antes.imagemCaminho) {
          throw new BadRequestException('Escolha a imagem.');
        }
        const noticia = await tx.noticia.update({
          where: { id },
          data: dados,
          select: CAMPOS,
        });
        const mudanca = diferencas(
          { imagem: antes.imagemNome, descricaoImagem: antes.imagemDescricao },
          { imagem: nome, descricaoImagem: dados.imagemDescricao },
        );
        // Imagem nova com o mesmo nome da anterior também entra no log.
        const registro = nome
          ? {
              valorAnterior: {
                ...mudanca?.valorAnterior,
                imagem: antes.imagemNome,
              },
              valorNovo: { ...mudanca?.valorNovo, imagem: nome },
            }
          : mudanca;
        if (registro) {
          await this.auditoria.registrar(tx, {
            usuarioId,
            acao: 'NOTICIA_IMAGEM_ALTERADA',
            entidade: ENTIDADE,
            entidadeId: id,
            ...registro,
          });
        }
        return {
          noticia: paraNoticia(noticia),
          caminhoAntigo: caminho ? antes.imagemCaminho : null,
        };
      });
    } catch (erro) {
      if (caminho) await this.excluirArquivo(caminho);
      throw erro;
    }

    if (resultado.caminhoAntigo) {
      await this.excluirArquivo(resultado.caminhoAntigo);
    }
    return resultado.noticia;
  }

  /** Tira a imagem da notícia; a notícia continua no feed. */
  async removerImagem(usuarioId: string, id: string): Promise<Noticia> {
    const { noticia, caminho } = await this.prisma.$transaction(async (tx) => {
      const antes = await this.buscarNoFeed(tx, id);
      if (!antes.imagemCaminho) {
        throw new NotFoundException('A notícia não tem imagem.');
      }
      const semImagem = await tx.noticia.update({
        where: { id },
        data: { imagemCaminho: null, imagemNome: null, imagemDescricao: null },
        select: CAMPOS,
      });
      await this.auditoria.registrar(tx, {
        usuarioId,
        acao: 'NOTICIA_IMAGEM_REMOVIDA',
        entidade: ENTIDADE,
        entidadeId: id,
        valorAnterior: {
          imagem: antes.imagemNome,
          descricaoImagem: antes.imagemDescricao,
        },
      });
      return { noticia: paraNoticia(semImagem), caminho: antes.imagemCaminho };
    });

    await this.excluirArquivo(caminho);
    return noticia;
  }

  /** A imagem de uma notícia do feed, para quem está logado (RN28). */
  async obterImagem(
    id: string,
  ): Promise<{ stream: Readable; contentType: string }> {
    const { imagemCaminho } = await this.buscarNoFeed(this.prisma, id);
    const arquivo =
      imagemCaminho && (await this.armazenamento.obter(imagemCaminho));
    if (!arquivo) {
      throw new NotFoundException('A notícia não tem imagem.');
    }
    return arquivo;
  }

  /** Notícia removida (ou rascunho) conta como não encontrada. */
  private async buscarNoFeed(tx: Prisma.TransactionClient, id: string) {
    const noticia = await tx.noticia.findFirst({
      where: { id, ...NO_FEED },
      select: {
        titulo: true,
        conteudo: true,
        imagemCaminho: true,
        imagemNome: true,
        imagemDescricao: true,
      },
    });
    if (!noticia) {
      throw new NotFoundException('Notícia não encontrada.');
    }
    return noticia;
  }

  /** Arquivo que sobrou no armazenamento não atrapalha a notícia. */
  private async excluirArquivo(caminho: string): Promise<void> {
    await this.armazenamento.excluir(caminho).catch(() => undefined);
  }
}

/**
 * Extensão pelos primeiros bytes do arquivo, sem confiar no tipo que o
 * navegador informa. Nulo quando não é JPG, PNG nem WebP.
 */
export function extensaoDaImagem(
  conteudo: Buffer,
): '.jpg' | '.png' | '.webp' | null {
  const bytes = (de: number, ate: number) =>
    conteudo.subarray(de, ate).toString('latin1');
  if (bytes(0, 3) === '\xff\xd8\xff') return '.jpg';
  if (bytes(0, 8) === '\x89PNG\r\n\x1a\n') return '.png';
  if (bytes(0, 4) === 'RIFF' && bytes(8, 12) === 'WEBP') return '.webp';
  return null;
}

/**
 * A data vai em texto ISO. Só notícias publicadas chegam aqui. O caminho da
 * imagem não sai da API: a tela só fica sabendo que a imagem existe.
 */
function paraNoticia({
  publicadaEm,
  imagemCaminho,
  imagemDescricao,
  ...noticia
}: Prisma.NoticiaGetPayload<{ select: typeof CAMPOS }>): Noticia {
  if (!publicadaEm) {
    throw new Error('Notícia sem data de publicação.');
  }
  return {
    ...noticia,
    publicadaEm: publicadaEm.toISOString(),
    imagem: imagemCaminho ? { descricao: imagemDescricao } : null,
  };
}
