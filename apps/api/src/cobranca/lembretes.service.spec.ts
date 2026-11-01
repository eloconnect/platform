import { lembreteDevido } from './lembretes.service.js';

/** Boleto que vence em 10/06/2099. */
const VENCIMENTO = new Date('2099-06-10');

/** Dia de junho ou julho de 2099, à meia-noite UTC. */
const dia = (texto: string) => new Date(`2099-${texto}`);

describe('lembreteDevido (RN07)', () => {
  it.each([
    ['07/06, 3 dias antes', '06-07', null, null],
    ['08/06, 48h antes', '06-08', null, 'LEMBRETE_ANTES'],
    ['09/06, véspera, sem lembrete', '06-09', null, 'LEMBRETE_ANTES'],
    [
      '09/06, véspera, com o lembrete do dia 8',
      '06-09',
      '2099-06-08T11:20:00Z',
      null,
    ],
    ['10/06, dia do vencimento', '06-10', '2099-06-08T11:20:00Z', null],
    ['16/06, 6 dias depois', '06-16', '2099-06-08T11:20:00Z', null],
    [
      '17/06, uma semana depois',
      '06-17',
      '2099-06-08T11:20:00Z',
      'LEMBRETE_VENCIDO',
    ],
    ['18/06, com o lembrete do dia 17', '06-18', '2099-06-17T11:20:00Z', null],
    [
      '18/06, se o do dia 17 não saiu',
      '06-18',
      '2099-06-08T11:20:00Z',
      'LEMBRETE_VENCIDO',
    ],
    [
      '24/06, duas semanas depois',
      '06-24',
      '2099-06-17T11:20:00Z',
      'LEMBRETE_VENCIDO',
    ],
    [
      '08/07, quatro semanas depois',
      '07-08',
      '2099-07-01T11:20:00Z',
      'LEMBRETE_VENCIDO',
    ],
    [
      '10/07, último dia para pagar, com o lembrete do dia 8',
      '07-10',
      '2099-07-08T11:20:00Z',
      null,
    ],
    ['11/07, boleto expirado', '07-11', '2099-07-01T11:20:00Z', null],
  ] as const)('%s', (_caso, hoje, ultimoLembreteEm, esperado) => {
    expect(
      lembreteDevido(
        {
          vencimento: VENCIMENTO,
          ultimoLembreteEm: ultimoLembreteEm
            ? new Date(ultimoLembreteEm)
            : null,
        },
        dia(hoje),
      ),
    ).toBe(esperado);
  });

  it('a semana começa à meia-noite de Mato Grosso', () => {
    // 17/06, 0h30 em Mato Grosso: já é a segunda semana.
    const ultimo = new Date('2099-06-17T04:30:00Z');
    // 16/06, 23h30 em Mato Grosso: ainda é a primeira semana.
    const anterior = new Date('2099-06-17T03:30:00Z');

    expect(
      lembreteDevido(
        { vencimento: VENCIMENTO, ultimoLembreteEm: ultimo },
        dia('06-17'),
      ),
    ).toBeNull();
    expect(
      lembreteDevido(
        { vencimento: VENCIMENTO, ultimoLembreteEm: anterior },
        dia('06-17'),
      ),
    ).toBe('LEMBRETE_VENCIDO');
  });
});
