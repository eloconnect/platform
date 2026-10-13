import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type SituacaoSindical = 'EM_DIA' | 'PENDENTE' | 'INADIMPLENTE';

const POR_PAGINA = 5;

function situacaoSindical(a: {
  situacao: string;
  contribuicaoAtiva: boolean;
}): SituacaoSindical {
  if (a.situacao === 'ADIMPLENTE') return 'EM_DIA';
  return a.contribuicaoAtiva ? 'INADIMPLENTE' : 'PENDENTE';
}

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  private async valorVigente() {
    return this.prisma.valorContribuicao.findFirst({
      orderBy: { criadoEm: 'desc' },
    });
  }

  async resumo() {
    const ativos = { inativadoEm: null };
    const [total, emDia, comContribuicao, valor] = await Promise.all([
      this.prisma.associado.count({ where: ativos }),
      this.prisma.associado.count({
        where: { ...ativos, situacao: 'ADIMPLENTE' },
      }),
      this.prisma.associado.count({
        where: { ...ativos, contribuicaoAtiva: true },
      }),
      this.valorVigente(),
    ]);
    const mensal = Number(valor?.valorMensal ?? 0);
    return {
      totalAssociados: total,
      emDia,
      taxaAdimplencia: total ? Math.round((emDia / total) * 1000) / 10 : 0,
      arrecadacaoMensal: Math.round(mensal * comContribuicao * 100) / 100,
      valorMensal: mensal,
    };
  }

  async listarAssociados(busca: string | undefined, pagina: number) {
    const termo = busca?.trim();
    const digitos = termo?.replace(/\D/g, '') ?? '';
    const where = termo
      ? {
          OR: [
            { razaoSocial: { contains: termo, mode: 'insensitive' as const } },
            { nomeFantasia: { contains: termo, mode: 'insensitive' as const } },
            { municipio: { contains: termo, mode: 'insensitive' as const } },
            ...(digitos ? [{ cnpj: { contains: digitos } }] : []),
          ],
        }
      : {};
    const [total, itens] = await Promise.all([
      this.prisma.associado.count({ where }),
      this.prisma.associado.findMany({
        where,
        orderBy: { razaoSocial: 'asc' },
        skip: (pagina - 1) * POR_PAGINA,
        take: POR_PAGINA,
      }),
    ]);
    return {
      total,
      pagina,
      porPagina: POR_PAGINA,
      totalPaginas: Math.max(1, Math.ceil(total / POR_PAGINA)),
      itens: itens.map((a) => ({
        id: a.id,
        nome: a.nomeFantasia ?? a.razaoSocial,
        razaoSocial: a.razaoSocial,
        cnpj: a.cnpj,
        cidade: a.municipio ? `${a.municipio} / MT` : '',
        situacao: situacaoSindical(a),
        bloqueado: a.acessoManual === 'BLOQUEADO',
      })),
    };
  }

  async ficha(id: string) {
    const associado = await this.prisma.associado.findUnique({
      where: { id },
      include: {
        boletos: { orderBy: { competencia: 'desc' }, take: 6 },
      },
    });
    if (!associado) throw new NotFoundException('Associado não encontrado.');
    return {
      id: associado.id,
      razaoSocial: associado.razaoSocial,
      nomeFantasia: associado.nomeFantasia,
      cnpj: associado.cnpj,
      email: associado.email,
      telefone: associado.telefone,
      municipio: associado.municipio,
      filiadoDesde: associado.criadoEm,
      situacao: situacaoSindical(associado),
      bloqueado: associado.acessoManual === 'BLOQUEADO',
      boletos: associado.boletos.map((b) => ({
        id: b.id,
        competencia: b.competencia,
        vencimento: b.vencimento,
        valor: Number(b.valor),
        status: b.status,
        pagoEm: b.pagoEm,
      })),
    };
  }

  async valores() {
    const [vigente, anterior, ativos] = await Promise.all([
      this.valorVigente(),
      this.prisma.valorContribuicao.findFirst({
        orderBy: { criadoEm: 'desc' },
        skip: 1,
      }),
      this.prisma.associado.count({ where: { inativadoEm: null } }),
    ]);
    return {
      valorMensal: Number(vigente?.valorMensal ?? 0),
      valorAnual: Number(vigente?.valorAnual ?? 0),
      vigenteDesde: vigente?.criadoEm ?? null,
      valorAnterior: anterior ? Number(anterior.valorMensal) : null,
      estabelecimentos: ativos,
    };
  }

  async cancelamentos() {
    const pendentes = await this.prisma.solicitacaoCancelamento.findMany({
      where: { status: 'PENDENTE' },
      orderBy: { solicitadaEm: 'desc' },
      include: { associado: true },
    });
    return pendentes.map((s) => ({
      id: s.id,
      razaoSocial: s.associado.razaoSocial,
      cnpj: s.associado.cnpj,
      solicitadaEm: s.solicitadaEm,
    }));
  }

  /** Novo valor vigente: o histórico é imutável, então cria outro registro (RF18). */
  async proporValor(adminId: string, valorMensal: number, valorAnual?: number) {
    const anual = valorAnual ?? Math.round(valorMensal * 12 * 0.8 * 100) / 100;
    const anterior = await this.valorVigente();
    await this.prisma.$transaction([
      this.prisma.valorContribuicao.create({
        data: {
          valorMensal: valorMensal.toFixed(2),
          valorAnual: anual.toFixed(2),
          alteradoPorId: adminId,
        },
      }),
      this.prisma.logAuditoria.create({
        data: {
          usuarioId: adminId,
          acao: 'VALOR_ALTERADO',
          entidade: 'ValorContribuicao',
          valorAnterior: anterior
            ? {
                valorMensal: Number(anterior.valorMensal),
                valorAnual: Number(anterior.valorAnual),
              }
            : undefined,
          valorNovo: { valorMensal, valorAnual: anual },
        },
      }),
    ]);
    return this.valores();
  }

  async decidirCancelamento(adminId: string, id: string) {
    const solicitacao = await this.prisma.solicitacaoCancelamento.findUnique({
      where: { id },
    });
    if (!solicitacao)
      throw new NotFoundException('Solicitação não encontrada.');
    const agora = new Date();
    // Só aprova se ainda estiver pendente: evita decisão em dobro.
    const aprovada = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.solicitacaoCancelamento.updateMany({
        where: { id, status: 'PENDENTE' },
        data: { status: 'APROVADA', decididaEm: agora, decididaPorId: adminId },
      });
      if (count === 0) return false;
      await tx.associado.update({
        where: { id: solicitacao.associadoId },
        data: { inativadoEm: agora, contribuicaoAtiva: false },
      });
      await tx.logAuditoria.create({
        data: {
          usuarioId: adminId,
          acao: 'CANCELAMENTO_APROVADO',
          entidade: 'SolicitacaoCancelamento',
          entidadeId: id,
          associadoId: solicitacao.associadoId,
        },
      });
      return true;
    });
    if (!aprovada) {
      throw new ConflictException('Esta solicitação já foi decidida.');
    }
    return this.cancelamentos();
  }

  async definirAcesso(adminId: string, id: string, bloqueado: boolean) {
    const associado = await this.prisma.associado.findUnique({ where: { id } });
    if (!associado) throw new NotFoundException('Associado não encontrado.');
    const novo = bloqueado ? ('BLOQUEADO' as const) : null;
    await this.prisma.$transaction([
      this.prisma.associado.update({
        where: { id },
        data: { acessoManual: novo },
      }),
      this.prisma.logAuditoria.create({
        data: {
          usuarioId: adminId,
          acao: bloqueado ? 'ACESSO_BLOQUEADO' : 'ACESSO_LIBERADO',
          entidade: 'Associado',
          entidadeId: id,
          associadoId: id,
          valorAnterior: { acessoManual: associado.acessoManual },
          valorNovo: { acessoManual: novo },
        },
      }),
    ]);
    return this.ficha(id);
  }

  async convencoes() {
    const lista = await this.prisma.convencao.findMany({
      where: { publicadaEm: { not: null } },
      orderBy: [{ ano: 'desc' }, { criadoEm: 'desc' }],
      include: { anexos: true },
    });
    return lista.map((c) => ({
      id: c.id,
      titulo: c.titulo,
      ano: c.ano,
      resumo: c.resumo,
      publicadaEm: c.publicadaEm,
      anexos: c.anexos.length,
    }));
  }
}
