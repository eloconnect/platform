import { describe, expect, it } from 'vitest';
import { cnpjValido, normalizarCnpj } from './cnpj.js';

describe('normalizarCnpj', () => {
  it('tira a pontuação e passa as letras para maiúsculas', () => {
    expect(normalizarCnpj('12.abc.345/01de-35')).toBe('12ABC34501DE35');
    expect(normalizarCnpj(' 11.222.333/0001-81 ')).toBe('11222333000181');
  });
});

describe('cnpjValido', () => {
  it.each(['11.222.333/0001-81', '11222333000181'])(
    'aceita o CNPJ numérico %s',
    (cnpj) => expect(cnpjValido(cnpj)).toBe(true),
  );

  it.each(['12.ABC.345/01DE-35', '12abc34501de35'])(
    'aceita o CNPJ alfanumérico %s',
    (cnpj) => expect(cnpjValido(cnpj)).toBe(true),
  );

  it.each([
    ['dígito verificador errado', '11.222.333/0001-82'],
    ['dígito verificador alfanumérico errado', '12.ABC.345/01DE-36'],
    ['letra no dígito verificador', '12.ABC.345/01DE-3A'],
    ['tamanho errado', '11.222.333/0001-8'],
    ['todos os caracteres iguais', '00.000.000/0000-00'],
    ['vazio', ''],
  ])('recusa: %s', (_motivo, cnpj) => expect(cnpjValido(cnpj)).toBe(false));
});
