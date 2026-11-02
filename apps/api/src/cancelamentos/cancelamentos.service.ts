import type { PedidoCancelamento } from '@eloconnect/shared';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Cancelamento do boleto mensal (RN18). O associado pede pela área dele
 * (US26: RF26), e o pedido fica pendente: para a sede, ele aparece como
 * "Cancelamento solicitado". Até a decisão, a farmácia continua recebendo o
 * boleto.
 */
@Injectable()
export class CancelamentosService {
  constructor(private readonly prisma: PrismaService) {}

  async pedir(
    usuarioId: string,
    agora = new Date(),
  ): Promise<PedidoCancelamento> {
    const associadoId = await this.associadoDe(usuarioId);
    return this.prisma.$transaction(async (tx) => {
      // Trava o associado: dois pedidos ao mesmo tempo viram um só.
      await tx.$queryRaw`SELECT id FROM "Associado" WHERE id = ${associadoId}::uuid FOR UPDATE`;
      const associado = await tx.associado.findUniqueOrThrow({
        where: { id: associadoId },
        select: {
          contribuicaoAtiva: true,
          cancelamentos: {
            where: { status: 'PENDENTE' },
            select: { id: true },
          },
        },
      });
      if (!associado.contribuicaoAtiva) {
        throw new ConflictException('A farmácia não recebe o boleto mensal.');
      }
      if (associado.cancelamentos.length > 0) {
        throw new ConflictException(
          'O pedido de cancelamento já foi enviado. A sede vai responder.',
        );
      }
      const pedido = await tx.solicitacaoCancelamento.create({
        data: { associadoId, solicitadaEm: agora },
      });
      return { pedidoEm: pedido.solicitadaEm.toISOString() };
    });
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
