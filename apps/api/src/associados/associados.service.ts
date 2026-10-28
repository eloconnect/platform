import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditoriaService,
  diferencas,
} from '../auditoria/auditoria.service.js';
import {
  normalizarCnpj,
  type AcaoAuditoria,
  type StatusAssociado,
} from '@eloconnect/shared';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CriarAssociadoDto,
  DefinirAcessoDto,
  EditarAssociadoDto,
} from './dto/associado.dto.js';
import type { FiltrosAssociadosDto } from './dto/filtros-associados.dto.js';

/** Campos que a API devolve para a sede. */
const CAMPOS = {
  id: true,
  cnpj: true,
  razaoSocial: true,
  nomeFantasia: true,
  email: true,
  telefone: true,
  municipio: true,
  contribuicaoAtiva: true,
  situacao: true,
  acessoManual: true,
  inativadoEm: true,
  criadoEm: true,
  atualizadoEm: true,
} satisfies Prisma.AssociadoSelect;

const ENTIDADE = 'Associado';
const POR_PAGINA = 20;

/** Como cada opção do filtro de status vira condição no banco (RN22). */
const FILTRO_STATUS: Record<StatusAssociado, Prisma.AssociadoWhereInput> = {
  ADIMPLENTE: { situacao: 'ADIMPLENTE' },
  INADIMPLENTE: { situacao: 'INADIMPLENTE', contribuicaoAtiva: true },
  SEM_CONTRIBUICAO: { situacao: 'INADIMPLENTE', contribuicaoAtiva: false },
  CANCELAMENTO_SOLICITADO: { cancelamentos: { some: { status: 'PENDENTE' } } },
};

/** Ação do log para cada decisão sobre o acesso (RN11). */
const ACAO_ACESSO = {
  BLOQUEADO: 'ACESSO_BLOQUEADO',
  LIBERADO: 'ACESSO_LIBERADO',
  AUTOMATICO: 'ACESSO_AUTOMATICO',
} satisfies Record<string, AcaoAuditoria>;

/**
 * Lista, cadastro, edição, inativação e acesso manual dos associados pela
 * sede (RF06, RF08, RF09).
 */
@Injectable()
export class AssociadosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /**
   * Lista com busca por nome ou CNPJ, filtros e páginas (RF06). Os
   * inativados ficam de fora, a menos que sejam pedidos.
   */
  async listar({
    busca,
    status,
    contribuicaoAtiva,
    incluirInativos,
    pagina = 1,
  }: FiltrosAssociadosDto) {
    const texto = busca?.trim();
    const cnpj = texto ? normalizarCnpj(texto) : '';
    const where: Prisma.AssociadoWhereInput = {
      ...(incluirInativos ? {} : { inativadoEm: null }),
      // AND, para o filtro de status não apagar o de "Recebe boleto mensal".
      AND: [
        contribuicaoAtiva === undefined ? {} : { contribuicaoAtiva },
        status ? FILTRO_STATUS[status] : {},
      ],
      ...(texto
        ? {
            OR: [
              { razaoSocial: { contains: texto, mode: 'insensitive' } },
              { nomeFantasia: { contains: texto, mode: 'insensitive' } },
              ...(cnpj ? [{ cnpj: { contains: cnpj } }] : []),
            ],
          }
        : {}),
    };

    const [total, linhas] = await this.prisma.$transaction([
      this.prisma.associado.count({ where }),
      this.prisma.associado.findMany({
        where,
        orderBy: [{ razaoSocial: 'asc' }, { id: 'asc' }],
        skip: (pagina - 1) * POR_PAGINA,
        take: POR_PAGINA,
        select: {
          id: true,
          cnpj: true,
          razaoSocial: true,
          nomeFantasia: true,
          situacao: true,
          acessoManual: true,
          contribuicaoAtiva: true,
          inativadoEm: true,
          _count: {
            select: { cancelamentos: { where: { status: 'PENDENTE' } } },
          },
        },
      }),
    ]);

    return {
      itens: linhas.map(({ _count, ...linha }) => ({
        ...linha,
        cancelamentoSolicitado: _count.cancelamentos > 0,
      })),
      total,
      pagina,
      porPagina: POR_PAGINA,
    };
  }

  /**
   * Perfil do associado, com as solicitações de cancelamento e a conta de
   * acesso (RF07).
   */
  async buscar(id: string) {
    const associado = await this.prisma.associado.findUnique({
      where: { id },
      select: {
        ...CAMPOS,
        usuario: {
          select: { email: true, criadoEm: true, emailConfirmadoEm: true },
        },
        cancelamentos: {
          orderBy: { solicitadaEm: 'desc' },
          select: {
            id: true,
            status: true,
            motivo: true,
            observacaoSede: true,
            solicitadaEm: true,
            decididaEm: true,
            decididaPor: { select: { nome: true } },
          },
        },
      },
    });
    if (!associado) {
      throw new NotFoundException('Associado não encontrado.');
    }
    const { usuario, ...dados } = associado;
    return {
      ...dados,
      conta: usuario && {
        email: usuario.email,
        criadaEm: usuario.criadoEm,
        confirmadaEm: usuario.emailConfirmadoEm,
      },
    };
  }

  async criar(usuarioId: string, dados: CriarAssociadoDto) {
    // Objeto simples com os campos enviados, para o log.
    const { ...enviados } = dados;
    return this.comCnpjUnico(() =>
      this.prisma.$transaction(async (tx) => {
        const associado = await tx.associado.create({
          data: dados,
          select: CAMPOS,
        });
        await this.auditoria.registrar(tx, {
          usuarioId,
          acao: 'ASSOCIADO_CRIADO',
          entidade: ENTIDADE,
          entidadeId: associado.id,
          associadoId: associado.id,
          valorNovo: diferencas({}, enviados)?.valorNovo,
        });
        return associado;
      }),
    );
  }

  /**
   * Edita os dados e a contribuição ativa. A mudança na contribuição ativa
   * ("Recebe boleto mensal") gera uma ação própria no log (RN25, RN26).
   */
  async editar(usuarioId: string, id: string, dados: EditarAssociadoDto) {
    return this.comCnpjUnico(() =>
      this.prisma.$transaction(async (tx) => {
        const antes = await tx.associado.findUnique({ where: { id } });
        if (!antes) {
          throw new NotFoundException('Associado não encontrado.');
        }
        const associado = await tx.associado.update({
          where: { id },
          data: dados,
          select: CAMPOS,
        });

        const { contribuicaoAtiva, ...cadastro } = dados;
        const mudancaCadastro = diferencas(antes, cadastro);
        if (mudancaCadastro) {
          await this.auditoria.registrar(tx, {
            usuarioId,
            acao: 'ASSOCIADO_EDITADO',
            entidade: ENTIDADE,
            entidadeId: id,
            associadoId: id,
            ...mudancaCadastro,
          });
        }
        const mudancaContribuicao = diferencas(antes, { contribuicaoAtiva });
        if (mudancaContribuicao) {
          await this.auditoria.registrar(tx, {
            usuarioId,
            acao: contribuicaoAtiva
              ? 'CONTRIBUICAO_ATIVADA'
              : 'CONTRIBUICAO_INTERROMPIDA',
            entidade: ENTIDADE,
            entidadeId: id,
            associadoId: id,
            ...mudancaContribuicao,
          });
        }
        return associado;
      }),
    );
  }

  /**
   * Inativa o associado (RF08); não há exclusão.
   * TODO(P13): o que a inativação muda na conta de acesso e na cobrança
   * recorrente depende da resposta do cliente.
   */
  async inativar(usuarioId: string, id: string) {
    return this.definirInativacao(usuarioId, id, new Date());
  }

  /**
   * Bloqueia, libera ou devolve ao automático o acesso a benefícios e suporte
   * (RF09, RN11). A decisão da sede prevalece sobre a situação automática, e
   * os jobs de cobrança não a mudam. O motivo fica só no log de auditoria.
   * TODO(P17): até quando vale a liberação. Por enquanto, até a sede mudar.
   */
  async definirAcesso(
    usuarioId: string,
    id: string,
    { acessoManual, motivo }: DefinirAcessoDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const antes = await tx.associado.findUnique({ where: { id } });
      if (!antes) {
        throw new NotFoundException('Associado não encontrado.');
      }
      const mudanca = diferencas(antes, { acessoManual });
      // Já está como pedido: nada muda e nada vai para o log.
      if (!mudanca) {
        return tx.associado.findUniqueOrThrow({
          where: { id },
          select: CAMPOS,
        });
      }
      const associado = await tx.associado.update({
        where: { id },
        data: { acessoManual },
        select: CAMPOS,
      });
      await this.auditoria.registrar(tx, {
        usuarioId,
        acao: ACAO_ACESSO[acessoManual ?? 'AUTOMATICO'],
        entidade: ENTIDADE,
        entidadeId: id,
        associadoId: id,
        valorAnterior: mudanca.valorAnterior,
        valorNovo: { ...mudanca.valorNovo, motivo },
      });
      return associado;
    });
  }

  /** Desfaz a inativação. [A confirmar] com o cliente (P13). */
  async reativar(usuarioId: string, id: string) {
    return this.definirInativacao(usuarioId, id, null);
  }

  private async definirInativacao(
    usuarioId: string,
    id: string,
    inativadoEm: Date | null,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const antes = await tx.associado.findUnique({ where: { id } });
      if (!antes) {
        throw new NotFoundException('Associado não encontrado.');
      }
      // Já está como pedido: nada muda e nada vai para o log.
      if ((antes.inativadoEm === null) === (inativadoEm === null)) {
        return tx.associado.findUniqueOrThrow({
          where: { id },
          select: CAMPOS,
        });
      }
      const associado = await tx.associado.update({
        where: { id },
        data: { inativadoEm },
        select: CAMPOS,
      });
      await this.auditoria.registrar(tx, {
        usuarioId,
        acao: inativadoEm ? 'ASSOCIADO_INATIVADO' : 'ASSOCIADO_REATIVADO',
        entidade: ENTIDADE,
        entidadeId: id,
        associadoId: id,
        ...diferencas(antes, { inativadoEm }),
      });
      return associado;
    });
  }

  /** Troca o erro de CNPJ repetido do banco por uma mensagem para a sede. */
  private async comCnpjUnico<T>(operacao: () => Promise<T>): Promise<T> {
    try {
      return await operacao();
    } catch (erro) {
      if (
        erro instanceof Prisma.PrismaClientKnownRequestError &&
        erro.code === 'P2002'
      ) {
        throw new ConflictException('Já existe um associado com este CNPJ.');
      }
      throw erro;
    }
  }
}
