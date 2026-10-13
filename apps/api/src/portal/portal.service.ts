import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { ContaAssociado } from './portal.guard';

export interface Piso {
  funcao: string;
  pisoAnterior?: number;
  pisoNovo: number;
}

function pisos(json: unknown): Piso[] {
  if (!Array.isArray(json)) return [];
  const lista: Piso[] = [];
  for (const item of json as unknown[]) {
    if (typeof item !== 'object' || item === null) continue;
    const { funcao, pisoAnterior, pisoNovo } = item as Record<string, unknown>;
    if (typeof funcao === 'string' && typeof pisoNovo === 'number') {
      lista.push({
        funcao,
        pisoAnterior:
          typeof pisoAnterior === 'number' ? pisoAnterior : undefined,
        pisoNovo,
      });
    }
  }
  return lista;
}

@Injectable()
export class PortalService {
  constructor(private readonly prisma: PrismaService) {}

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
          associado.situacao === 'INADIMPLENTE'
            ? ('INADIMPLENTE' as const)
            : ('EM_DIA' as const),
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

  async convencoes() {
    const lista = await this.prisma.convencao.findMany({
      where: { publicadaEm: { not: null } },
      orderBy: { publicadaEm: 'desc' },
      include: { anexos: true },
    });
    return lista.map((c) => ({
      id: c.id,
      titulo: c.titulo,
      ano: c.ano,
      resumo: c.resumo,
      publicadaEm: c.publicadaEm,
      pisos: pisos(c.tabelaReajuste),
      anexos: c.anexos.length,
    }));
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

  async beneficios() {
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
