import { describe, expect, it } from 'vitest';
import {
  calcularValorAnual,
  competenciaDoNovoValor,
  formatarReais,
  lerValorEmReais,
  textoCompetencia,
} from './valores.js';

describe('calcularValorAnual', () => {
  it.each([
    ['120.00', '1152.00'],
    ['130.50', '1252.80'],
    // 0,96 centavo arredonda para 1 centavo; 9,6 centavos, para 10.
    ['0.01', '0.10'],
    ['99.99', '959.90'],
    ['999999.99', '9599999.90'],
  ])(
    'mensal de %s dá anual de %s (12 meses com 20%% de desconto)',
    (mensal, anual) => {
      expect(calcularValorAnual(mensal)).toBe(anual);
    },
  );
});

describe('lerValorEmReais', () => {
  it.each([
    ['130', '130.00'],
    ['130,5', '130.50'],
    ['130,50', '130.50'],
    ['130.50', '130.50'],
    ['R$ 130,50', '130.50'],
    [' 007 ', '7.00'],
  ])('lê "%s" como %s', (texto, valor) => {
    expect(lerValorEmReais(texto)).toBe(valor);
  });

  it.each(['', 'abc', '130,555', '1.152,00', '1000000', '-10'])(
    'recusa "%s"',
    (texto) => {
      expect(lerValorEmReais(texto)).toBeNull();
    },
  );
});

describe('competenciaDoNovoValor', () => {
  it('é o mês seguinte ao da alteração', () => {
    expect(competenciaDoNovoValor(new Date('2026-10-28T15:00:00Z'))).toEqual({
      ano: 2026,
      mes: 11,
    });
    expect(competenciaDoNovoValor(new Date('2026-12-15T15:00:00Z'))).toEqual({
      ano: 2027,
      mes: 1,
    });
  });

  it('usa o horário de Mato Grosso, e não o UTC', () => {
    // 01/11 às 03:30 em UTC ainda é 31/10 às 23:30 em Mato Grosso.
    expect(competenciaDoNovoValor(new Date('2026-11-01T03:30:00Z'))).toEqual({
      ano: 2026,
      mes: 11,
    });
    expect(competenciaDoNovoValor(new Date('2026-11-01T04:00:00Z'))).toEqual({
      ano: 2026,
      mes: 12,
    });
  });
});

describe('textos', () => {
  it('escreve o mês por extenso e o valor em reais', () => {
    expect(textoCompetencia({ ano: 2026, mes: 11 })).toBe('novembro de 2026');
    // O Intl separa o "R$" com um espaço que não quebra a linha.
    expect(formatarReais('1152.00').replace(/\s/g, ' ')).toBe('R$ 1.152,00');
  });
});
