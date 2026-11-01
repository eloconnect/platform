import type { BoletoEmAberto } from '@eloconnect/shared';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { GatewayPagamento, validoAte } from './gateway-pagamento.js';
import {
  competenciaDaData,
  hojeEmMatoGrosso,
  textoDia,
} from './valor-do-mes.js';

/**
 * Boletos do associado logado (US12: RF12, RN06): os que estão em aberto,
 * com o Pix e a linha digitável, e o PDF de cada um.
 */
@Injectable()
export class BoletosAssociadoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: GatewayPagamento,
  ) {}

  /** Boletos em aberto, do vencimento mais antigo ao mais novo. */
  async listar(
    usuarioId: string,
    agora = new Date(),
  ): Promise<BoletoEmAberto[]> {
    const associadoId = await this.associadoDe(usuarioId);
    const boletos = await this.prisma.boleto.findMany({
      where: { associadoId, status: 'EM_ABERTO' },
      orderBy: [{ vencimento: 'asc' }, { id: 'asc' }],
    });
    const hoje = hojeEmMatoGrosso(agora);
    return boletos.flatMap(
      ({
        id,
        competencia,
        valor,
        vencimento,
        linhaDigitavel,
        pixCopiaECola,
      }) =>
        linhaDigitavel && pixCopiaECola
          ? [
              {
                id,
                competencia: competenciaDaData(competencia),
                valor: valor.toFixed(2),
                vencimento: textoDia(vencimento),
                validoAte: textoDia(validoAte(vencimento)),
                vencido: vencimento < hoje,
                linhaDigitavel,
                pixCopiaECola,
              },
            ]
          : [],
    );
  }

  /** PDF de um boleto em aberto do associado, como o banco gera. */
  async pdf(
    usuarioId: string,
    boletoId: string,
  ): Promise<{ arquivo: Buffer; nomeArquivo: string }> {
    const associadoId = await this.associadoDe(usuarioId);
    const boleto = await this.prisma.boleto.findFirst({
      where: { id: boletoId, associadoId, status: 'EM_ABERTO' },
      include: { associado: { select: { cnpj: true, razaoSocial: true } } },
    });
    const { sicrediNossoNumero, linhaDigitavel, pixCopiaECola } = boleto ?? {};
    if (!boleto || !sicrediNossoNumero || !linhaDigitavel || !pixCopiaECola) {
      throw new NotFoundException('Boleto não encontrado.');
    }
    const arquivo = await this.gateway.pdf({
      boletoId,
      valor: boleto.valor,
      vencimento: boleto.vencimento,
      validoAte: validoAte(boleto.vencimento),
      pagador: {
        cnpj: boleto.associado.cnpj,
        nome: boleto.associado.razaoSocial,
      },
      nossoNumero: sicrediNossoNumero,
      linhaDigitavel,
      pixCopiaECola,
    });
    return {
      arquivo,
      nomeArquivo: `boleto-${textoDia(boleto.competencia).slice(0, 7)}.pdf`,
    };
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
