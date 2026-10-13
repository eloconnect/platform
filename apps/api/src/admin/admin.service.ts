import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type {
  AtualizarBeneficioDto,
  AtualizarConvencaoDto,
  NovaConvencaoDto,
  NovoBeneficioDto,
} from './admin.dto';
import { StatusSolicitacaoSuporte } from '../generated/prisma/enums';
import { removerPdf, salvarPdf } from './convencao-arquivos';

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

  async beneficios() {
    return this.prisma.beneficio.findMany({
      orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }],
    });
  }

  async criarBeneficio(adminId: string, dados: NovoBeneficioDto) {
    return this.prisma.$transaction(async (tx) => {
      const criado = await tx.beneficio.create({
        data: {
          titulo: dados.titulo.trim(),
          descricao: dados.descricao.trim(),
          ordem: dados.ordem,
        },
      });
      await tx.logAuditoria.create({
        data: {
          usuarioId: adminId,
          acao: 'BENEFICIO_CRIADO',
          entidade: 'Beneficio',
          entidadeId: criado.id,
          valorNovo: {
            titulo: criado.titulo,
            descricao: criado.descricao,
            ordem: criado.ordem,
            ativo: criado.ativo,
          },
        },
      });
      return criado;
    });
  }

  async atualizarBeneficio(
    adminId: string,
    id: string,
    dados: AtualizarBeneficioDto,
  ) {
    const anterior = await this.prisma.beneficio.findUnique({ where: { id } });
    if (!anterior) throw new NotFoundException('Benefício não encontrado.');
    return this.prisma.$transaction(async (tx) => {
      const atualizado = await tx.beneficio.update({
        where: { id },
        data: {
          ...(dados.titulo === undefined
            ? {}
            : { titulo: dados.titulo.trim() }),
          ...(dados.descricao === undefined
            ? {}
            : { descricao: dados.descricao.trim() }),
          ...(dados.ativo === undefined ? {} : { ativo: dados.ativo }),
          ...(dados.ordem === undefined ? {} : { ordem: dados.ordem }),
        },
      });
      await tx.logAuditoria.create({
        data: {
          usuarioId: adminId,
          acao: 'BENEFICIO_EDITADO',
          entidade: 'Beneficio',
          entidadeId: id,
          valorAnterior: {
            titulo: anterior.titulo,
            descricao: anterior.descricao,
            ordem: anterior.ordem,
            ativo: anterior.ativo,
          },
          valorNovo: {
            titulo: atualizado.titulo,
            descricao: atualizado.descricao,
            ordem: atualizado.ordem,
            ativo: atualizado.ativo,
          },
        },
      });
      return atualizado;
    });
  }

  async solicitacoesSuporte() {
    const lista = await this.prisma.solicitacaoSuporte.findMany({
      orderBy: [{ status: 'asc' }, { criadaEm: 'desc' }],
      include: {
        associado: { select: { razaoSocial: true, cnpj: true } },
      },
    });
    return lista.map((solicitacao) => ({
      id: solicitacao.id,
      associado: solicitacao.associado.razaoSocial,
      cnpj: solicitacao.associado.cnpj,
      mensagem: solicitacao.mensagem,
      status: solicitacao.status,
      criadaEm: solicitacao.criadaEm,
      atualizadaEm: solicitacao.atualizadaEm,
    }));
  }

  async atualizarStatusSuporte(
    adminId: string,
    id: string,
    status: StatusSolicitacaoSuporte,
  ) {
    const anterior = await this.prisma.solicitacaoSuporte.findUnique({
      where: { id },
      select: { id: true, status: true, associadoId: true },
    });
    if (!anterior) {
      throw new NotFoundException('Solicitação de suporte não encontrada.');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.solicitacaoSuporte.update({ where: { id }, data: { status } });
      await tx.logAuditoria.create({
        data: {
          usuarioId: adminId,
          acao: 'SUPORTE_STATUS_ATUALIZADO',
          entidade: 'SolicitacaoSuporte',
          entidadeId: id,
          associadoId: anterior.associadoId,
          valorAnterior: { status: anterior.status },
          valorNovo: { status },
        },
      });
    });
    return { id, status };
  }

  async convencoes() {
    const lista = await this.prisma.convencao.findMany({
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
      arquivos: c.anexos.map((anexo) => ({
        id: anexo.id,
        nomeArquivo: anexo.nomeArquivo,
        tamanhoBytes: anexo.tamanhoBytes,
      })),
    }));
  }

  async criarConvencao(adminId: string, dados: NovaConvencaoDto) {
    const publicadaEm = dados.publicar ? new Date() : null;
    const convencao = await this.prisma.$transaction(async (tx) => {
      const criada = await tx.convencao.create({
        data: {
          titulo: dados.titulo.trim(),
          ano: dados.ano,
          resumo: dados.resumo.trim(),
          publicadaEm,
          autorId: adminId,
        },
      });
      await tx.logAuditoria.create({
        data: {
          usuarioId: adminId,
          acao: publicadaEm ? 'CONVENCAO_PUBLICADA' : 'CONVENCAO_CRIADA',
          entidade: 'Convencao',
          entidadeId: criada.id,
          valorNovo: {
            titulo: criada.titulo,
            ano: criada.ano,
            resumo: criada.resumo,
            publicadaEm: publicadaEm?.toISOString() ?? null,
          },
        },
      });
      return criada;
    });
    return {
      id: convencao.id,
      titulo: convencao.titulo,
      ano: convencao.ano,
      resumo: convencao.resumo,
      publicadaEm: convencao.publicadaEm,
    };
  }

  async atualizarConvencao(
    adminId: string,
    id: string,
    dados: AtualizarConvencaoDto,
  ) {
    const anterior = await this.prisma.convencao.findUnique({
      where: { id },
    });
    if (!anterior) throw new NotFoundException('Convenção não encontrada.');

    const publicadaEm =
      dados.publicar === undefined
        ? anterior.publicadaEm
        : dados.publicar
          ? (anterior.publicadaEm ?? new Date())
          : null;
    const atualizada = await this.prisma.$transaction(async (tx) => {
      const salva = await tx.convencao.update({
        where: { id },
        data: {
          ...(dados.titulo === undefined
            ? {}
            : { titulo: dados.titulo.trim() }),
          ...(dados.ano === undefined ? {} : { ano: dados.ano }),
          ...(dados.resumo === undefined
            ? {}
            : { resumo: dados.resumo.trim() }),
          ...(dados.publicar === undefined ? {} : { publicadaEm }),
        },
      });
      await tx.logAuditoria.create({
        data: {
          usuarioId: adminId,
          acao:
            !anterior.publicadaEm && publicadaEm
              ? 'CONVENCAO_PUBLICADA'
              : 'CONVENCAO_EDITADA',
          entidade: 'Convencao',
          entidadeId: id,
          valorAnterior: {
            titulo: anterior.titulo,
            ano: anterior.ano,
            resumo: anterior.resumo,
            publicadaEm: anterior.publicadaEm?.toISOString() ?? null,
          },
          valorNovo: {
            titulo: salva.titulo,
            ano: salva.ano,
            resumo: salva.resumo,
            publicadaEm: salva.publicadaEm?.toISOString() ?? null,
          },
        },
      });
      return salva;
    });
    return {
      id: atualizada.id,
      titulo: atualizada.titulo,
      ano: atualizada.ano,
      resumo: atualizada.resumo,
      publicadaEm: atualizada.publicadaEm,
    };
  }

  async anexarPdf(
    adminId: string,
    id: string,
    arquivo: { buffer: Buffer; originalname: string; size: number },
  ) {
    if (!arquivo.originalname.toLowerCase().endsWith('.pdf')) {
      throw new UnsupportedMediaTypeException(
        'O arquivo enviado deve ter extensão PDF.',
      );
    }
    const convencao = await this.prisma.convencao.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!convencao) throw new NotFoundException('Convenção não encontrada.');

    const arquivoUrl = await salvarPdf(arquivo.buffer);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const anexo = await tx.convencaoAnexo.create({
          data: {
            convencaoId: id,
            nomeArquivo: arquivo.originalname.slice(0, 255),
            arquivoUrl,
            tamanhoBytes: arquivo.size,
          },
        });
        await tx.logAuditoria.create({
          data: {
            usuarioId: adminId,
            acao: 'CONVENCAO_ANEXO_ADICIONADO',
            entidade: 'ConvencaoAnexo',
            entidadeId: anexo.id,
            valorNovo: {
              convencaoId: id,
              nomeArquivo: anexo.nomeArquivo,
              tamanhoBytes: anexo.tamanhoBytes,
            },
          },
        });
        return {
          id: anexo.id,
          nomeArquivo: anexo.nomeArquivo,
          tamanhoBytes: anexo.tamanhoBytes,
        };
      });
    } catch (erro) {
      await removerPdf(arquivoUrl);
      throw erro;
    }
  }
}
