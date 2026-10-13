import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { ContaAssociado } from './portal.guard';
import { lerPdf } from '../admin/convencao-arquivos';
import { StatusSolicitacaoSuporte } from '../generated/prisma/enums';

@Injectable()
export class PortalService {
  constructor(private readonly prisma: PrismaService) {}

  private podeAcessarBeneficios(associado: {
    situacao: string;
    acessoManual: string | null;
  }) {
    return (
      associado.acessoManual === 'LIBERADO' ||
      (associado.acessoManual !== 'BLOQUEADO' &&
        associado.situacao === 'ADIMPLENTE')
    );
  }

  private async farmacia(associadoId: string) {
    const associado = await this.prisma.associado.findUnique({
      where: { id: associadoId },
    });
    if (!associado) throw new NotFoundException('Farmácia não encontrada.');
    return associado;
  }

  async painel({ associadoId, usuarioId }: ContaAssociado) {
    const [associado, usuario, valor, aberto, pendente] = await Promise.all([
      this.farmacia(associadoId),
      this.prisma.usuario.findUnique({ where: { id: usuarioId } }),
      this.prisma.valorContribuicao.findFirst({
        orderBy: { criadoEm: 'desc' },
      }),
      this.prisma.boleto.findFirst({
        where: { associadoId, status: 'EM_ABERTO' },
        orderBy: { vencimento: 'asc' },
      }),
      this.prisma.solicitacaoCancelamento.count({
        where: { associadoId, status: 'PENDENTE' },
      }),
    ]);
    return {
      nomeUsuario: usuario?.nome ?? '',
      farmacia: {
        razaoSocial: associado.razaoSocial,
        nomeFantasia: associado.nomeFantasia,
        cnpj: associado.cnpj,
        situacao:
          associado.acessoManual === 'BLOQUEADO' ||
          (associado.acessoManual !== 'LIBERADO' &&
            associado.situacao === 'INADIMPLENTE')
            ? 'INADIMPLENTE'
            : 'EM_DIA',
      },
      valorMensal: Number(valor?.valorMensal ?? 0),
      valorAnual: Number(valor?.valorAnual ?? 0),
      recorrente: associado.contribuicaoAtiva,
      cancelamentoPendente: pendente > 0,
      boleto: aberto
        ? {
            id: aberto.id,
            competencia: aberto.competencia,
            vencimento: aberto.vencimento,
            valor: Number(aberto.valor),
            status: aberto.status,
            linhaDigitavel: aberto.linhaDigitavel,
            pixCopiaECola: aberto.pixCopiaECola,
          }
        : null,
    };
  }

  async historico({ associadoId }: ContaAssociado) {
    const [associado, pagos, aberto] = await Promise.all([
      this.farmacia(associadoId),
      this.prisma.boleto.findMany({
        where: { associadoId, status: 'PAGO' },
        orderBy: { competencia: 'desc' },
        take: 12,
      }),
      this.prisma.boleto.count({
        where: { associadoId, status: 'EM_ABERTO' },
      }),
    ]);
    const itens = pagos.map((b) => ({
      id: b.id,
      competencia: b.competencia,
      pagoEm: b.pagoEm,
      valor: Number(b.valor),
    }));
    return {
      razaoSocial: associado.razaoSocial,
      nomeFantasia: associado.nomeFantasia,
      cnpj: associado.cnpj,
      emDia: aberto === 0 && associado.situacao === 'ADIMPLENTE',
      itens,
      totalPeriodo:
        Math.round(itens.reduce((soma, i) => soma + i.valor, 0) * 100) / 100,
    };
  }

  async convencoes({ associadoId }: ContaAssociado) {
    const associado = await this.farmacia(associadoId);
    const lista = await this.prisma.convencao.findMany({
      where: { publicadaEm: { not: null } },
      orderBy: { publicadaEm: 'desc' },
      include: {
        anexos: true,
        inscricoes: {
          where: { associadoId },
          select: { id: true },
        },
      },
    });
    return lista.map((c) => ({
      id: c.id,
      titulo: c.titulo,
      ano: c.ano,
      resumo: c.resumo,
      publicadaEm: c.publicadaEm,
      inscrito: c.inscricoes.length > 0,
      podeInscrever: this.podeAcessarBeneficios(associado),
      anexos: c.anexos.length,
      arquivos: c.anexos.map((anexo) => ({
        id: anexo.id,
        nomeArquivo: anexo.nomeArquivo,
        tamanhoBytes: anexo.tamanhoBytes,
      })),
    }));
  }

  async inscreverConvencao(conta: ContaAssociado, convencaoId: string) {
    const associado = await this.farmacia(conta.associadoId);
    if (!this.podeAcessarBeneficios(associado)) {
      throw new ForbiddenException(
        'A inscrição em convenção é exclusiva para associados adimplentes.',
      );
    }
    const convencao = await this.prisma.convencao.findFirst({
      where: { id: convencaoId, publicadaEm: { not: null } },
      select: { id: true },
    });
    if (!convencao) throw new NotFoundException('Convenção não encontrada.');

    const inscricao = await this.prisma.inscricaoConvencao.upsert({
      where: {
        associadoId_convencaoId: {
          associadoId: conta.associadoId,
          convencaoId,
        },
      },
      update: {},
      create: { associadoId: conta.associadoId, convencaoId },
      select: { inscritaEm: true },
    });
    return inscricao;
  }

  async anexoConvencao(convencaoId: string, anexoId: string) {
    const anexo = await this.prisma.convencaoAnexo.findFirst({
      where: { id: anexoId, convencaoId },
      include: { convencao: { select: { publicadaEm: true } } },
    });
    if (!anexo || !anexo.convencao.publicadaEm) {
      throw new NotFoundException('Anexo não encontrado.');
    }
    return {
      nomeArquivo: anexo.nomeArquivo,
      conteudo: await lerPdf(anexo.arquivoUrl),
    };
  }

  async noticias() {
    const lista = await this.prisma.noticia.findMany({
      where: { publicadaEm: { not: null }, removidaEm: null },
      orderBy: { publicadaEm: 'desc' },
    });
    return lista.map((n) => ({
      id: n.id,
      titulo: n.titulo,
      conteudo: n.conteudo,
      publicadaEm: n.publicadaEm,
    }));
  }

  async beneficios({ associadoId }: ContaAssociado) {
    const associado = await this.farmacia(associadoId);
    if (!this.podeAcessarBeneficios(associado)) {
      throw new ForbiddenException(
        'Benefícios e suporte são exclusivos para associados adimplentes.',
      );
    }
    return this.listaBeneficios();
  }

  async beneficiosPublicos() {
    return this.listaBeneficios();
  }

  private async listaBeneficios() {
    const lista = await this.prisma.beneficio.findMany({
      where: { ativo: true },
      orderBy: { ordem: 'asc' },
    });
    return lista.map((b) => ({
      id: b.id,
      titulo: b.titulo,
      descricao: b.descricao,
    }));
  }

  async solicitarSuporte(conta: ContaAssociado, mensagem: string) {
    const associado = await this.farmacia(conta.associadoId);
    if (!this.podeAcessarBeneficios(associado)) {
      throw new ForbiddenException(
        'O suporte jurídico é exclusivo para associados adimplentes.',
      );
    }
    const texto = mensagem.trim();
    if (!texto) throw new BadRequestException('Descreva sua solicitação.');
    const solicitacao = await this.prisma.solicitacaoSuporte.create({
      data: {
        associadoId: conta.associadoId,
        usuarioId: conta.usuarioId,
        mensagem: texto,
        status: StatusSolicitacaoSuporte.RECEBIDA,
      },
      select: { id: true, status: true, criadaEm: true },
    });
    return solicitacao;
  }

  async definirRecorrencia(conta: ContaAssociado, ativo: boolean) {
    await this.farmacia(conta.associadoId);
    await this.prisma.$transaction([
      this.prisma.associado.update({
        where: { id: conta.associadoId },
        data: { contribuicaoAtiva: ativo },
      }),
      this.prisma.logAuditoria.create({
        data: {
          usuarioId: conta.usuarioId,
          acao: ativo
            ? 'ENVIO_AUTOMATICO_ATIVADO'
            : 'ENVIO_AUTOMATICO_DESATIVADO',
          entidade: 'Associado',
          entidadeId: conta.associadoId,
          associadoId: conta.associadoId,
          valorNovo: { contribuicaoAtiva: ativo },
        },
      }),
    ]);
    return this.painel(conta);
  }

  async solicitarCancelamento(conta: ContaAssociado, motivo?: string) {
    await this.farmacia(conta.associadoId);
    const pendente = await this.prisma.solicitacaoCancelamento.count({
      where: { associadoId: conta.associadoId, status: 'PENDENTE' },
    });
    if (pendente > 0) {
      throw new ConflictException(
        'Já existe um pedido de cancelamento em análise.',
      );
    }
    await this.prisma.$transaction([
      this.prisma.solicitacaoCancelamento.create({
        data: {
          associadoId: conta.associadoId,
          motivo: motivo?.trim() || null,
        },
      }),
      this.prisma.logAuditoria.create({
        data: {
          usuarioId: conta.usuarioId,
          acao: 'CANCELAMENTO_SOLICITADO',
          entidade: 'SolicitacaoCancelamento',
          associadoId: conta.associadoId,
        },
      }),
    ]);
    return this.painel(conta);
  }
}
