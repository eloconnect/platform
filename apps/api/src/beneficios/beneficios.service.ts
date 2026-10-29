import { Injectable, NotFoundException } from '@nestjs/common';
import type { Beneficio } from '@eloconnect/shared';
import {
  AuditoriaService,
  diferencas,
} from '../auditoria/auditoria.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CriarBeneficioDto,
  EditarBeneficioDto,
} from './dto/beneficio.dto.js';

const CAMPOS = {
  id: true,
  titulo: true,
  descricao: true,
  grupo: true,
} satisfies Prisma.BeneficioSelect;

const ENTIDADE = 'Beneficio';

/**
 * Benefícios do sindicato (US24, RF24), em dois grupos (RN32). A lista é
 * pública, para a página inicial; a sede cadastra, edita e remove.
 * TODO(P06): a lista real de benefícios depende do cliente.
 */
@Injectable()
export class BeneficiosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** Benefícios ativos, na ordem de cadastro. */
  listar(): Promise<Beneficio[]> {
    return this.prisma.beneficio.findMany({
      where: { ativo: true },
      orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }, { id: 'asc' }],
      select: CAMPOS,
    });
  }

  async criar(
    usuarioId: string,
    { titulo, descricao, grupo }: CriarBeneficioDto,
  ): Promise<Beneficio> {
    return this.prisma.$transaction(async (tx) => {
      // O novo entra no fim da lista.
      const { _max } = await tx.beneficio.aggregate({ _max: { ordem: true } });
      const beneficio = await tx.beneficio.create({
        data: { titulo, descricao, grupo, ordem: (_max.ordem ?? 0) + 1 },
        select: CAMPOS,
      });
      await this.auditoria.registrar(tx, {
        usuarioId,
        acao: 'BENEFICIO_CRIADO',
        entidade: ENTIDADE,
        entidadeId: beneficio.id,
        valorNovo: { titulo, descricao, grupo },
      });
      return beneficio;
    });
  }

  async editar(
    usuarioId: string,
    id: string,
    { titulo, descricao, grupo }: EditarBeneficioDto,
  ): Promise<Beneficio> {
    // Campo não enviado fica undefined: não muda nem entra no log.
    const dados = { titulo, descricao, grupo };
    return this.prisma.$transaction(async (tx) => {
      const antes = await this.buscarAtivo(tx, id);
      const beneficio = await tx.beneficio.update({
        where: { id },
        data: dados,
        select: CAMPOS,
      });
      const mudanca = diferencas(antes, dados);
      if (mudanca) {
        await this.auditoria.registrar(tx, {
          usuarioId,
          acao: 'BENEFICIO_EDITADO',
          entidade: ENTIDADE,
          entidadeId: id,
          ...mudanca,
        });
      }
      return beneficio;
    });
  }

  /** Desliga o benefício: ele sai das listas, e o registro fica para o log. */
  async remover(usuarioId: string, id: string): Promise<Beneficio> {
    return this.prisma.$transaction(async (tx) => {
      await this.buscarAtivo(tx, id);
      const beneficio = await tx.beneficio.update({
        where: { id },
        data: { ativo: false },
        select: CAMPOS,
      });
      await this.auditoria.registrar(tx, {
        usuarioId,
        acao: 'BENEFICIO_REMOVIDO',
        entidade: ENTIDADE,
        entidadeId: id,
      });
      return beneficio;
    });
  }

  /** Benefício removido conta como não encontrado. */
  private async buscarAtivo(tx: Prisma.TransactionClient, id: string) {
    const beneficio = await tx.beneficio.findFirst({
      where: { id, ativo: true },
      select: CAMPOS,
    });
    if (!beneficio) {
      throw new NotFoundException('Benefício não encontrado.');
    }
    return beneficio;
  }
}
