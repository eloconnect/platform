import { describe, expect, it } from 'vitest';
import { formatarDia, textoMesBoleto, textoSituacaoBoleto } from './boletos.js';

describe('formatarDia', () => {
  it('mostra o dia como no Brasil, sem mudar de dia pelo fuso', () => {
    expect(formatarDia('2026-12-10')).toBe('10/12/2026');
    expect(formatarDia('2027-01-01T00:00:00.000Z')).toBe('01/01/2027');
  });
});

describe('textoMesBoleto', () => {
  it('mostra o mês e, fora do mensal, o tipo do boleto', () => {
    const competencia = { ano: 2099, mes: 6 };

    expect(textoMesBoleto({ competencia, tipo: 'MENSAL' })).toBe(
      'junho de 2099',
    );
    expect(textoMesBoleto({ competencia, tipo: 'AVULSO' })).toBe(
      'junho de 2099 (avulso)',
    );
    expect(textoMesBoleto({ competencia, tipo: 'ANUAL' })).toBe(
      'junho de 2099 (plano anual)',
    );
  });
});

describe('textoSituacaoBoleto', () => {
  const boleto = {
    status: 'EM_ABERTO',
    vencido: false,
    pagoEm: null,
    formaPagamento: null,
  } as const;

  it('diferencia o boleto em aberto do vencido', () => {
    expect(textoSituacaoBoleto(boleto)).toBe('Em aberto');
    expect(textoSituacaoBoleto({ ...boleto, vencido: true })).toBe('Vencido');
  });

  it('mostra o dia do pagamento em Mato Grosso e a forma de pagamento', () => {
    // 9 de junho, 23h30 em Mato Grosso (UTC-4), já 10 de junho em UTC.
    expect(
      textoSituacaoBoleto({
        ...boleto,
        status: 'PAGO',
        pagoEm: '2099-06-10T03:30:00.000Z',
        formaPagamento: 'PIX',
      }),
    ).toBe('Pago em 09/06/2099, com Pix');
    expect(
      textoSituacaoBoleto({
        ...boleto,
        status: 'PAGO',
        formaPagamento: 'BOLETO',
      }),
    ).toBe('Pago, com boleto');
  });

  it('mostra os boletos em emissão, cancelados e expirados', () => {
    expect(textoSituacaoBoleto({ ...boleto, status: 'RASCUNHO' })).toBe(
      'Em emissão',
    );
    expect(textoSituacaoBoleto({ ...boleto, status: 'CANCELADO' })).toBe(
      'Cancelado',
    );
    expect(textoSituacaoBoleto({ ...boleto, status: 'EXPIRADO' })).toBe(
      'Expirado, sem pagamento',
    );
  });
});
