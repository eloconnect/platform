import { jest } from '@jest/globals';
import { type Boleto, Prisma } from '../generated/prisma/client.js';
import { TransacoesService } from './transacoes.service.js';

const BOLETO: Boleto = {
  id: 'boleto-id',
  associadoId: 'associado-id',
  loteId: null,
  tipo: 'MENSAL',
  competencia: new Date('2026-11-01'),
  valor: new Prisma.Decimal('120.00'),
  vencimento: new Date('2026-11-10'),
  status: 'RASCUNHO',
  sicrediNossoNumero: null,
  linhaDigitavel: null,
  pixCopiaECola: null,
  emitidoEm: null,
  emailEnviadoEm: null,
  pagoEm: null,
  ultimoLembreteEm: null,
  criadoEm: new Date('2026-11-01T12:00:00.000Z'),
  atualizadoEm: new Date('2026-11-01T12:00:00.000Z'),
};

/** Transação do banco falsa, com o boleto que o Prisma devolveria. */
function transacaoFalsa(boleto: Boleto = BOLETO) {
  const boletos = {
    create: jest.fn(() => Promise.resolve(boleto)),
    update: jest.fn(() => Promise.resolve(boleto)),
  };
  const transacoes = { create: jest.fn(() => Promise.resolve({})) };
  const falsa = { boleto: boletos, transacao: transacoes };
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const tx = falsa as unknown as Prisma.TransactionClient;
  return { tx, boletos, transacoes };
}

describe('TransacoesService', () => {
  const servico = new TransacoesService();

  it('cria o boleto e registra o GERADO como ação do sistema', async () => {
    const { tx, boletos, transacoes } = transacaoFalsa();
    const dados = {
      associadoId: 'associado-id',
      tipo: 'MENSAL' as const,
      competencia: new Date('2026-11-01'),
      vencimento: new Date('2026-11-10'),
      valor: '120.00',
    };

    await expect(servico.criarBoleto(tx, dados)).resolves.toBe(BOLETO);

    expect(boletos.create).toHaveBeenCalledWith({ data: dados });
    expect(transacoes.create).toHaveBeenCalledWith({
      data: {
        boletoId: 'boleto-id',
        associadoId: 'associado-id',
        evento: 'GERADO',
        valor: BOLETO.valor,
        sicrediNossoNumero: null,
        formaPagamento: null,
        usuarioId: null,
        detalhes: undefined,
      },
    });
  });

  it('registra o pagamento com a forma e os dados de depois da mudança', async () => {
    const pago: Boleto = {
      ...BOLETO,
      status: 'PAGO',
      sicrediNossoNumero: 'NN-0001',
    };
    const { tx, boletos, transacoes } = transacaoFalsa(pago);
    const pagoEm = new Date('2026-11-08T13:00:00.000Z');

    await servico.alterarBoleto(
      tx,
      'boleto-id',
      { status: 'PAGO', pagoEm },
      { evento: 'PAGO', formaPagamento: 'PIX' },
    );

    expect(boletos.update).toHaveBeenCalledWith({
      where: { id: 'boleto-id' },
      data: { status: 'PAGO', pagoEm },
    });
    expect(transacoes.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        evento: 'PAGO',
        formaPagamento: 'PIX',
        sicrediNossoNumero: 'NN-0001',
        usuarioId: null,
      }),
    });
  });

  it('guarda quem da sede fez a mudança e o motivo', async () => {
    const { tx, transacoes } = transacaoFalsa();

    await servico.alterarBoleto(
      tx,
      'boleto-id',
      { status: 'CANCELADO' },
      {
        evento: 'CANCELADO',
        usuarioId: 'admin-id',
        detalhes: { motivo: 'Pedido da farmácia.' },
      },
    );

    expect(transacoes.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        evento: 'CANCELADO',
        formaPagamento: null,
        usuarioId: 'admin-id',
        detalhes: { motivo: 'Pedido da farmácia.' },
      }),
    });
  });

  it('não registra nada quando a mudança do boleto falha', async () => {
    const { tx, boletos, transacoes } = transacaoFalsa();
    boletos.update.mockRejectedValueOnce(new Error('Boleto não encontrado.'));

    await expect(
      servico.alterarBoleto(
        tx,
        'boleto-id',
        { status: 'CANCELADO' },
        { evento: 'CANCELADO' },
      ),
    ).rejects.toThrow('Boleto não encontrado.');
    expect(transacoes.create).not.toHaveBeenCalled();
  });
});
