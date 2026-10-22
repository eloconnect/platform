import { Injectable } from '@nestjs/common';
import type { PaginaInicialResponse } from '@eloconnect/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PublicoService {
  constructor(private readonly prisma: PrismaService) {}

  async obterPaginaInicial(): Promise<PaginaInicialResponse> {
    const [configuracao, beneficios, convencoes, noticias] = await Promise.all([
      this.prisma.configuracaoPaginaInicial.findUnique({
        where: { id: 1 },
      }),

      this.prisma.beneficio.findMany({
        where: { ativo: true },
        orderBy: [{ ordem: 'asc' }, { titulo: 'asc' }],
        select: {
          id: true,
          titulo: true,
          descricao: true,
        },
      }),

      this.prisma.convencao.findMany({
        where: { publicadaEm: { not: null } },
        orderBy: [{ ano: 'desc' }, { publicadaEm: 'desc' }],
        take: 6,
        select: {
          id: true,
          titulo: true,
          ano: true,
          resumo: true,
        },
      }),

      this.prisma.noticia.findMany({
        where: {
          publicadaEm: { not: null },
          removidaEm: null,
        },
        orderBy: { publicadaEm: 'desc' },
        take: 3,
        select: {
          id: true,
          titulo: true,
          conteudo: true,
          publicadaEm: true,
        },
      }),
    ]);

    return {
      configuracao: {
        titulo:
          configuracao?.titulo ??
          'Informações do sindicato para farmácias associadas',
        descricao:
          configuracao?.descricao ??
          'Acesse informações sobre benefícios, convenções coletivas e suporte. Entre no portal para consultar os serviços disponíveis.',
        imagemUrl: configuracao?.imagemUrl ?? null,
        imagemAlt: configuracao?.imagemAlt ?? null,
      },
      beneficios,
      convencoes,
      noticias: noticias.map((noticia) => ({
        ...noticia,
        publicadaEm: noticia.publicadaEm!.toISOString(),
      })),
    };
  }
}
