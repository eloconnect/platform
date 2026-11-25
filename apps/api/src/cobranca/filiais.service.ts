import {
  ehMatriz,
  raizCnpj,
  textoSituacao,
  type Filial,
} from '@eloconnect/shared';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { BoletosAssociadoService } from './boletos-associado.service.js';

/**
 * Matriz e filiais (RF43, RN31). Decisão do grupo, com aval do cliente (P14,
 * 24/11/2026): a conta da matriz (CNPJ de ordem 0001) vê as filiais com a
 * mesma raiz do CNPJ, com a situação de cada uma e os boletos em aberto, e
 * baixa o PDF deles para pagar. A ligação é automática, pelo CNPJ (RN27).
 * Cada filial continua com a própria situação e a própria cobrança; a
 * filial que tem conta própria continua entrando nela.
 */
@Injectable()
export class FiliaisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly boletos: BoletosAssociadoService,
  ) {}

  /** Vazio para quem não é matriz. */
  async listar(usuarioId: string, agora = new Date()): Promise<Filial[]> {
    const matriz = await this.matrizDe(usuarioId);
    if (!matriz) return [];
    const filiais = await this.prisma.associado.findMany({
      where: {
        cnpj: { startsWith: raizCnpj(matriz.cnpj), not: matriz.cnpj },
        // TODO(P13): o que a inativação muda; a inativada fica de fora.
        inativadoEm: null,
      },
      orderBy: { cnpj: 'asc' },
      select: {
        id: true,
        cnpj: true,
        razaoSocial: true,
        nomeFantasia: true,
        situacao: true,
        contribuicaoAtiva: true,
      },
    });
    return Promise.all(
      filiais.map(async (filial) => ({
        id: filial.id,
        cnpj: filial.cnpj,
        nome: filial.nomeFantasia ?? filial.razaoSocial,
        situacao: textoSituacao(filial),
        boletos: await this.boletos.emAbertoDe(filial.id, agora),
      })),
    );
  }

  async pdf(usuarioId: string, filialId: string, boletoId: string) {
    const matriz = await this.matrizDe(usuarioId);
    const filial =
      matriz &&
      (await this.prisma.associado.findFirst({
        where: {
          id: filialId,
          cnpj: { startsWith: raizCnpj(matriz.cnpj), not: matriz.cnpj },
        },
        select: { id: true },
      }));
    if (!filial) throw new NotFoundException('Boleto não encontrado.');
    return this.boletos.pdfDe(filial.id, boletoId);
  }

  private async matrizDe(usuarioId: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { associado: { select: { cnpj: true } } },
    });
    const cnpj = usuario?.associado?.cnpj;
    return cnpj && ehMatriz(cnpj) ? { cnpj } : null;
  }
}
