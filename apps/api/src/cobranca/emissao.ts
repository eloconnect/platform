import type { Prisma } from '../generated/prisma/client.js';
import { type GatewayPagamento, validoAte } from './gateway-pagamento.js';
import type { TransacoesService } from './transacoes.service.js';

/**
 * Emite no banco o boleto em RASCUNHO e guarda o que o banco devolveu, com o
 * evento EMITIDO no histórico. Roda dentro da transação de quem chama, que
 * já travou o boleto: o lote mensal e a adesão.
 */
export async function emitirBoleto(
  tx: Prisma.TransactionClient,
  gateway: GatewayPagamento,
  transacoes: TransacoesService,
  id: string,
): Promise<void> {
  const boleto = await tx.boleto.findUniqueOrThrow({
    where: { id },
    include: { associado: { select: { cnpj: true, razaoSocial: true } } },
  });
  const emitido = await gateway.emitir({
    boletoId: id,
    valor: boleto.valor,
    vencimento: boleto.vencimento,
    validoAte: validoAte(boleto.vencimento),
    pagador: {
      cnpj: boleto.associado.cnpj,
      nome: boleto.associado.razaoSocial,
    },
  });
  // TODO(#40): se a gravação falhar depois da emissão, o boleto pode ser
  // emitido de novo. O estudo diz se o Sicredi recusa um segundo boleto com o
  // mesmo id.
  await transacoes.alterarBoleto(
    tx,
    id,
    {
      status: 'EM_ABERTO',
      sicrediNossoNumero: emitido.nossoNumero,
      linhaDigitavel: emitido.linhaDigitavel,
      pixCopiaECola: emitido.pixCopiaECola,
      emitidoEm: new Date(),
    },
    { evento: 'EMITIDO' },
  );
}
