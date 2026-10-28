import { describe, expect, it } from 'vitest';
import { textoSituacao } from './situacao.js';

describe('textoSituacao', () => {
  it.each([
    ['ADIMPLENTE', true, 'Adimplente'],
    ['ADIMPLENTE', false, 'Adimplente'],
    ['INADIMPLENTE', true, 'Inadimplente'],
    ['INADIMPLENTE', false, 'Sem contribuição ativa'],
  ] as const)(
    '%s com contribuição ativa %s aparece como "%s"',
    (situacao, contribuicaoAtiva, texto) => {
      expect(textoSituacao({ situacao, contribuicaoAtiva })).toBe(texto);
    },
  );
});
