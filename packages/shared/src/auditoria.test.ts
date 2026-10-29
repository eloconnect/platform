import { describe, expect, it } from 'vitest';
import {
  ACOES_AUDITORIA,
  TEXTO_ACAO_AUDITORIA,
  textoAcaoAuditoria,
} from './auditoria.js';

describe('textoAcaoAuditoria', () => {
  it('cada ação do catálogo tem um texto próprio', () => {
    const textos = ACOES_AUDITORIA.map((acao) => textoAcaoAuditoria(acao));

    expect(textos.every((texto) => texto.trim() !== '')).toBe(true);
    expect(new Set(textos).size).toBe(ACOES_AUDITORIA.length);
    expect(Object.keys(TEXTO_ACAO_AUDITORIA)).toHaveLength(
      ACOES_AUDITORIA.length,
    );
  });

  it('mostra o código de uma ação fora do catálogo', () => {
    expect(textoAcaoAuditoria('ACESSO_BLOQUEADO')).toBe('Acesso bloqueado');
    expect(textoAcaoAuditoria('ACAO_ANTIGA')).toBe('ACAO_ANTIGA');
  });
});
