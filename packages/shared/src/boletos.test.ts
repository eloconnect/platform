import { describe, expect, it } from 'vitest';
import { formatarDia } from './boletos.js';

describe('formatarDia', () => {
  it('mostra o dia como no Brasil, sem mudar de dia pelo fuso', () => {
    expect(formatarDia('2026-12-10')).toBe('10/12/2026');
    expect(formatarDia('2027-01-01T00:00:00.000Z')).toBe('01/01/2027');
  });
});
