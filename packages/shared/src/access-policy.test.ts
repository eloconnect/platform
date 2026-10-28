import { describe, expect, it } from 'vitest';
import { acessoManualEmVigor } from './access-policy.js';

describe('acessoManualEmVigor', () => {
  const agora = new Date('2026-10-28T12:00:00Z');

  it.each([
    ['liberação em vigor', 'LIBERADO', '2026-10-29T12:00:00Z', 'LIBERADO'],
    ['liberação vencida', 'LIBERADO', '2026-10-28T12:00:00Z', null],
    ['liberação sem data', 'LIBERADO', null, 'LIBERADO'],
    ['bloqueio, que não vence', 'BLOQUEADO', null, 'BLOQUEADO'],
    ['sem decisão manual', null, null, null],
  ] as const)('%s', (_caso, acessoManual, ate, esperado) => {
    expect(acessoManualEmVigor(acessoManual, ate, agora)).toBe(esperado);
  });
});
