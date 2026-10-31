import { ehDiaUtil, pascoa, primeiroDiaUtil } from './dia-util.js';

describe('pascoa', () => {
  it.each([
    [2025, '2025-04-20'],
    [2026, '2026-04-05'],
    [2027, '2027-03-28'],
    [2029, '2029-04-01'],
  ])('em %i cai em %s', (ano, data) => {
    expect(pascoa(ano).toISOString().slice(0, 10)).toBe(data);
  });
});

describe('primeiroDiaUtil', () => {
  it.each([
    ['dezembro de 2026 começa numa terça', 2026, 12, 1],
    ['fevereiro de 2026 começa num domingo', 2026, 2, 2],
    ['1º de maio de 2026 é feriado numa sexta', 2026, 5, 4],
    ['1º de janeiro de 2027 é feriado numa sexta', 2027, 1, 4],
    ['em novembro de 2026, o dia 1 é domingo e o 2 é Finados', 2026, 11, 3],
    ['a Sexta-feira Santa de 2067 cai em 1º de abril', 2067, 4, 4],
    ['a segunda de Carnaval de 2025 conta como dia útil', 2025, 3, 3],
  ])('%s', (_caso, ano, mes, dia) => {
    expect(primeiroDiaUtil({ ano, mes })).toBe(dia);
  });
});

describe('ehDiaUtil', () => {
  it('não conta os feriados do resto do mês', () => {
    expect(ehDiaUtil(new Date('2026-09-07'))).toBe(false);
    expect(ehDiaUtil(new Date('2026-11-20'))).toBe(false);
    expect(ehDiaUtil(new Date('2026-04-03'))).toBe(false);
    expect(ehDiaUtil(new Date('2026-09-08'))).toBe(true);
  });
});
