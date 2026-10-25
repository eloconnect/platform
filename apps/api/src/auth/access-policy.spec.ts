import { describe, expect, it } from '@jest/globals';
import { podeAcessarRecursoRestrito } from '@eloconnect/shared';

describe('podeAcessarRecursoRestrito', () => {
  it('permite associado adimplente sem decisão manual', () => {
    expect(podeAcessarRecursoRestrito('ADIMPLENTE', null)).toBe(true);
  });

  it('bloqueia associado inadimplente sem decisão manual', () => {
    expect(podeAcessarRecursoRestrito('INADIMPLENTE', null)).toBe(false);
  });

  it('permite associado inadimplente liberado manualmente', () => {
    expect(podeAcessarRecursoRestrito('INADIMPLENTE', 'LIBERADO')).toBe(true);
  });

  it('bloqueia associado adimplente bloqueado manualmente', () => {
    expect(podeAcessarRecursoRestrito('ADIMPLENTE', 'BLOQUEADO')).toBe(false);
  });
});
