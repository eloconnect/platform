import { formatarCnpj, type InscricaoConvencao } from '@eloconnect/shared';
import { Injectable, NotFoundException } from '@nestjs/common';
import { MARGEM, ALTURA, montarPdf, texto } from '../cobranca/pdf.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Inscrição em convenção (US23: RF23). Decisão do grupo, com aval do cliente
 * (P05, 24/11/2026): a farmácia em dia se inscreve na convenção publicada,
 * declarando que segue as regras dela, e baixa um comprovante em PDF, com a
 * farmácia, o CNPJ, a convenção e a data. A sede vê a lista das inscritas.
 * Uma inscrição por convenção e farmácia; inscrever de novo não muda a data.
 */
@Injectable()
export class InscricoesService {
  constructor(private readonly prisma: PrismaService) {}

  /** O guarda de acesso já conferiu que o associado está em dia. */
  async inscrever(usuarioId: string, convencaoId: string, agora = new Date()) {
    const associadoId = await this.associadoDe(usuarioId);
    const convencao = await this.prisma.convencao.findFirst({
      where: { id: convencaoId, publicadaEm: { not: null } },
      select: { id: true },
    });
    if (!convencao) throw new NotFoundException('Convenção não encontrada.');
    // Dois cliques juntos viram uma inscrição só.
    const inscricao = await this.prisma.inscricaoConvencao.upsert({
      where: { convencaoId_associadoId: { convencaoId, associadoId } },
      create: { convencaoId, associadoId, usuarioId, inscritaEm: agora },
      update: {},
      select: { inscritaEm: true },
    });
    return { inscritaEm: inscricao.inscritaEm.toISOString() };
  }

  async comprovante(
    usuarioId: string,
    convencaoId: string,
  ): Promise<{ arquivo: Buffer; nomeArquivo: string }> {
    const associadoId = await this.associadoDe(usuarioId);
    const inscricao = await this.prisma.inscricaoConvencao.findUnique({
      where: { convencaoId_associadoId: { convencaoId, associadoId } },
      select: {
        inscritaEm: true,
        convencao: { select: { titulo: true, ano: true } },
        associado: { select: { razaoSocial: true, cnpj: true } },
      },
    });
    if (!inscricao) throw new NotFoundException('Inscrição não encontrada.');
    const quando = inscricao.inscritaEm.toLocaleString('pt-BR', {
      timeZone: 'America/Cuiaba',
    });
    let y = ALTURA - MARGEM - 20;
    const linhas: string[] = [];
    const linha = (conteudo: string, tamanho = 12, negrito = false) => {
      linhas.push(texto(MARGEM, y, conteudo, tamanho, negrito ? 'F2' : 'F1'));
      y -= tamanho + 10;
    };
    linha('Comprovante de inscrição em convenção coletiva', 16, true);
    y -= 10;
    linha(`Farmácia: ${inscricao.associado.razaoSocial}`);
    linha(`CNPJ: ${formatarCnpj(inscricao.associado.cnpj)}`);
    linha(
      `Convenção: ${inscricao.convencao.titulo} (${inscricao.convencao.ano})`,
    );
    linha(`Inscrita em: ${quando} (horário de Mato Grosso)`);
    y -= 10;
    linha(
      'A farmácia se inscreveu nesta convenção pelo Elo Connect, com a',
      11,
    );
    linha('contribuição ao sindicato em dia na data da inscrição.', 11);
    return {
      arquivo: montarPdf([linhas.join('\n')]),
      nomeArquivo: `inscricao-convencao-${inscricao.associado.cnpj}.pdf`,
    };
  }

  /** Farmácias inscritas, da inscrição mais antiga à mais nova. */
  async listar(convencaoId: string): Promise<InscricaoConvencao[]> {
    const inscricoes = await this.prisma.inscricaoConvencao.findMany({
      where: { convencaoId },
      orderBy: { inscritaEm: 'asc' },
      select: {
        inscritaEm: true,
        associado: { select: { id: true, cnpj: true, razaoSocial: true } },
      },
    });
    return inscricoes.map(({ inscritaEm, associado }) => ({
      associadoId: associado.id,
      cnpj: associado.cnpj,
      razaoSocial: associado.razaoSocial,
      inscritaEm: inscritaEm.toISOString(),
    }));
  }

  private async associadoDe(usuarioId: string): Promise<string> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { associadoId: true },
    });
    if (!usuario?.associadoId) {
      throw new NotFoundException('Associado não encontrado.');
    }
    return usuario.associadoId;
  }
}
