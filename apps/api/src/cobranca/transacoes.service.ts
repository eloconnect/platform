import { Injectable } from '@nestjs/common';
import type { Boleto, Prisma } from '../generated/prisma/client.js';
import type {
  EventoTransacao,
  FormaPagamento,
} from '../generated/prisma/enums.js';

/** O pagamento sempre diz se foi pelo boleto ou pelo Pix (RF30). */
type Registro = (
  | { evento: 'PAGO'; formaPagamento: FormaPagamento }
  | { evento: Exclude<EventoTransacao, 'PAGO'> }
) & {
  /** Quem da sede fez a mudança. Sem ele, foi o sistema. */
  usuarioId?: string;
  /** O que explica a mudança, como o motivo de um cancelamento. */
  detalhes?: Prisma.InputJsonObject;
};

/** Uma mudança do boleto já criado: o GERADO é só da criação. */
export type MudancaBoleto = Registro & {
  evento: Exclude<EventoTransacao, 'GERADO'>;
};

/**
 * Histórico de transações dos boletos (RN17, RF30). Todo código que cria ou
 * muda um boleto passa por aqui, e cada mudança vira uma linha nova no
 * histórico, com a data e a hora, uma cópia do valor e do nosso número, a
 * forma de pagamento e quem fez. O banco recusa alterar ou apagar essas
 * linhas (trigger da migration init).
 *
 * Os dois métodos recebem a transação do banco da própria operação, para que
 * o boleto e o histórico entrem juntos, ou nenhum dos dois.
 */
@Injectable()
export class TransacoesService {
  /** Cria o boleto e registra o evento GERADO. */
  async criarBoleto(
    tx: Prisma.TransactionClient,
    dados: Prisma.BoletoUncheckedCreateInput,
    usuarioId?: string,
  ): Promise<Boleto> {
    const boleto = await tx.boleto.create({ data: dados });
    await this.registrar(tx, boleto, { evento: 'GERADO', usuarioId });
    return boleto;
  }

  /** Muda o boleto e registra o evento, com os dados de depois da mudança. */
  async alterarBoleto(
    tx: Prisma.TransactionClient,
    id: string,
    dados: Prisma.BoletoUncheckedUpdateInput,
    mudanca: MudancaBoleto,
  ): Promise<Boleto> {
    const boleto = await tx.boleto.update({ where: { id }, data: dados });
    await this.registrar(tx, boleto, mudanca);
    return boleto;
  }

  private async registrar(
    tx: Prisma.TransactionClient,
    boleto: Boleto,
    registro: Registro,
  ): Promise<void> {
    await tx.transacao.create({
      data: {
        boletoId: boleto.id,
        associadoId: boleto.associadoId,
        evento: registro.evento,
        valor: boleto.valor,
        sicrediNossoNumero: boleto.sicrediNossoNumero,
        formaPagamento:
          registro.evento === 'PAGO' ? registro.formaPagamento : null,
        usuarioId: registro.usuarioId ?? null,
        detalhes: registro.detalhes,
      },
    });
  }
}
