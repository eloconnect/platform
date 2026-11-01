import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '../generated/prisma/client.js';
import { CobrancaModule } from './cobranca.module.js';
import { GatewayPagamento, type PedidoBoleto } from './gateway-pagamento.js';
import { GatewaySimulado } from './gateway-simulado.js';

const PEDIDO: PedidoBoleto = {
  boletoId: 'boleto-id',
  valor: new Prisma.Decimal('120.00'),
  vencimento: new Date('2026-11-10'),
  validoAte: new Date('2026-12-10'),
  pagador: { cnpj: '41015838000136', nome: 'Farmácia Exemplo 02 Ltda' },
};

describe('GatewaySimulado', () => {
  let gateway: GatewaySimulado;

  beforeEach(() => {
    gateway = new GatewaySimulado();
  });

  it('emite o boleto em aberto, com a linha digitável de 47 dígitos e o Pix', async () => {
    const emitido = await gateway.emitir(PEDIDO);

    expect(emitido.nossoNumero).toMatch(/^SIM\d{12}$/);
    const digitos = emitido.linhaDigitavel.replace(/\D/g, '');
    expect(digitos).toHaveLength(47);
    // O valor em centavos fica no fim, como na linha de verdade.
    expect(digitos.endsWith('0000012000')).toBe(true);
    expect(emitido.pixCopiaECola).toContain(emitido.nossoNumero);
    await expect(gateway.consultar(emitido.nossoNumero)).resolves.toEqual({
      situacao: 'EM_ABERTO',
    });
  });

  it('dá um nosso número diferente a cada boleto', async () => {
    const primeiro = await gateway.emitir(PEDIDO);
    const segundo = await gateway.emitir(PEDIDO);

    expect(segundo.nossoNumero).not.toBe(primeiro.nossoNumero);
  });

  it('mostra o pagamento na consulta e manda a notificação que a API lê', async () => {
    const { nossoNumero } = await gateway.emitir(PEDIDO);
    const pagoEm = new Date('2026-11-08T14:30:00.000Z');

    const notificacao = gateway.pagar(nossoNumero, 'PIX', pagoEm);

    const pagamento = {
      nossoNumero,
      formaPagamento: 'PIX',
      valorPago: new Prisma.Decimal('120.00'),
      pagoEm,
    };
    await expect(gateway.consultar(nossoNumero)).resolves.toEqual({
      situacao: 'PAGO',
      pagamento,
    });
    // A notificação chega pela rede, em JSON.
    const recebida: unknown = JSON.parse(JSON.stringify(notificacao));
    expect(gateway.lerNotificacao(recebida)).toEqual(pagamento);
  });

  it('cancela o boleto em aberto, que depois não pode ser pago', async () => {
    const { nossoNumero } = await gateway.emitir(PEDIDO);

    await gateway.cancelar(nossoNumero);

    await expect(gateway.consultar(nossoNumero)).resolves.toEqual({
      situacao: 'CANCELADO',
    });
    expect(() => gateway.pagar(nossoNumero, 'BOLETO')).toThrow(
      ConflictException,
    );
  });

  it('não cancela nem recebe de novo o boleto pago', async () => {
    const { nossoNumero } = await gateway.emitir(PEDIDO);
    gateway.pagar(nossoNumero, 'BOLETO');

    await expect(gateway.cancelar(nossoNumero)).rejects.toThrow(
      ConflictException,
    );
    expect(() => gateway.pagar(nossoNumero, 'PIX')).toThrow(ConflictException);
  });

  it('não acha o boleto que ele não emitiu', async () => {
    await expect(gateway.consultar('NAO-EMITIDO')).rejects.toThrow(
      NotFoundException,
    );
    await expect(gateway.cancelar('NAO-EMITIDO')).rejects.toThrow(
      NotFoundException,
    );
    expect(() => gateway.pagar('NAO-EMITIDO', 'PIX')).toThrow(
      NotFoundException,
    );
  });

  const VALIDA = {
    nossoNumero: 'SIM000000000001',
    formaPagamento: 'BOLETO',
    valorPago: '120.00',
    pagoEm: '2026-11-08T14:30:00.000Z',
  };

  it('lê a notificação válida', () => {
    expect(gateway.lerNotificacao(VALIDA)).toEqual({
      nossoNumero: 'SIM000000000001',
      formaPagamento: 'BOLETO',
      valorPago: new Prisma.Decimal('120.00'),
      pagoEm: new Date('2026-11-08T14:30:00.000Z'),
    });
  });

  it.each([
    ['vazia', null],
    ['em texto', JSON.stringify(VALIDA)],
    ['sem o nosso número', { ...VALIDA, nossoNumero: '' }],
    [
      'com forma de pagamento desconhecida',
      { ...VALIDA, formaPagamento: 'CARTAO' },
    ],
    ['com o valor sem centavos', { ...VALIDA, valorPago: '120' }],
    ['com o valor em número', { ...VALIDA, valorPago: 120 }],
    ['com data inválida', { ...VALIDA, pagoEm: 'ontem' }],
  ])('recusa a notificação %s', (_caso, corpo) => {
    expect(() => gateway.lerNotificacao(corpo)).toThrow(BadRequestException);
  });
});

describe('CobrancaModule', () => {
  it('usa o gateway simulado enquanto não há convênio com o Sicredi', async () => {
    // O banco e as configurações vêm de módulos globais, fora deste teste.
    const modulo = await Test.createTestingModule({
      imports: [CobrancaModule],
    })
      .useMocker(() => ({}))
      .compile();

    expect(modulo.get(GatewayPagamento)).toBeInstanceOf(GatewaySimulado);
  });
});
