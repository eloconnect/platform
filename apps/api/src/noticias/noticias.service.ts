import { Injectable, NotFoundException } from '@nestjs/common';
import type { Noticia } from '@eloconnect/shared';
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
} satisfies Prisma.NoticiaSelect;

/** Publicada e não removida: é o que aparece no feed. */
const NO_FEED = {
  publicadaEm: { not: null },
  removidaEm: null,
} satisfies Prisma.NoticiaWhereInput;

const ENTIDADE = 'Noticia';

/**
 * Feed de notícias (RF35, RN28) e publicação pela sede (RF41). A notícia sai
 * no feed assim que é publicada; a data é a da publicação.
 */
@Injectable()
export class NoticiasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
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

  /** Notícia removida (ou rascunho) conta como não encontrada. */
  private async buscarNoFeed(tx: Prisma.TransactionClient, id: string) {
    const noticia = await tx.noticia.findFirst({
      where: { id, ...NO_FEED },
      select: { titulo: true, conteudo: true },
    });
    if (!noticia) {
      throw new NotFoundException('Notícia não encontrada.');
    }
    return noticia;
  }
}

/** A data vai em texto ISO. Só notícias publicadas chegam aqui. */
function paraNoticia({
  publicadaEm,
  ...noticia
}: Prisma.NoticiaGetPayload<{ select: typeof CAMPOS }>): Noticia {
  if (!publicadaEm) {
    throw new Error('Notícia sem data de publicação.');
  }
  return { ...noticia, publicadaEm: publicadaEm.toISOString() };
}
