import { prazoVencidoAntesDe, respostaAte } from './prazo.js';

describe('prazo da sede para responder ao cancelamento (RN18)', () => {
  it('vai até 15 dias depois do dia do pedido, no horário de Mato Grosso', () => {
    // 02/11, 12h em Mato Grosso.
    expect(respostaAte(new Date('2026-11-02T16:00:00Z'))).toBe('2026-11-17');
    // 02/11, 23h30 em Mato Grosso, já 03/11 em UTC: o dia conta como 02/11.
    expect(respostaAte(new Date('2026-11-03T03:30:00Z'))).toBe('2026-11-17');
  });

  it('o pedido passa do prazo no dia seguinte ao último dia para responder', () => {
    const pedido = new Date('2026-11-03T03:30:00Z');

    // 17/11, 7h em Mato Grosso: ainda dentro do prazo.
    expect(pedido < prazoVencidoAntesDe(new Date('2026-11-17T11:00:00Z'))).toBe(
      false,
    );
    // 18/11, 0h30 em Mato Grosso: passou.
    expect(pedido < prazoVencidoAntesDe(new Date('2026-11-18T04:30:00Z'))).toBe(
      true,
    );
  });
});
