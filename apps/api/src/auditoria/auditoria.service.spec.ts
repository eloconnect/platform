import { jest } from '@jest/globals';
import {
  AuditoriaService,
  diferencas,
  type Transacao,
} from './auditoria.service.js';

describe('AuditoriaService', () => {
  it('grava o registro na transação recebida', async () => {
    const create = jest.fn(() => Promise.resolve({}));
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const tx = { logAuditoria: { create } } as unknown as Transacao;
    const registro = {
      usuarioId: 'admin-id',
      acao: 'ASSOCIADO_EDITADO' as const,
      entidade: 'Associado',
      entidadeId: 'associado-id',
      associadoId: 'associado-id',
      valorAnterior: { telefone: null },
      valorNovo: { telefone: '(65) 90000-0000' },
    };

    await new AuditoriaService().registrar(tx, registro);

    expect(create).toHaveBeenCalledWith({ data: registro });
  });
});

describe('diferencas', () => {
  const antes = {
    razaoSocial: 'Farmácia Exemplo Ltda',
    telefone: null,
    contribuicaoAtiva: false,
    inativadoEm: null,
  };

  it('devolve só os campos que mudaram', () => {
    expect(
      diferencas(antes, {
        razaoSocial: 'Farmácia Exemplo Ltda',
        telefone: '(65) 90000-0000',
        contribuicaoAtiva: true,
      }),
    ).toEqual({
      valorAnterior: { telefone: null, contribuicaoAtiva: false },
      valorNovo: { telefone: '(65) 90000-0000', contribuicaoAtiva: true },
    });
  });

  it('ignora os campos ausentes no estado novo', () => {
    expect(diferencas(antes, { telefone: undefined })).toBeNull();
  });

  it('devolve null quando nada mudou', () => {
    expect(diferencas(antes, { ...antes })).toBeNull();
  });

  it('grava datas como texto ISO', () => {
    const data = new Date('2026-10-27T12:00:00.000Z');
    expect(diferencas(antes, { inativadoEm: data })).toEqual({
      valorAnterior: { inativadoEm: null },
      valorNovo: { inativadoEm: '2026-10-27T12:00:00.000Z' },
    });
  });

  it('considera iguais duas datas com o mesmo instante', () => {
    expect(
      diferencas(
        { inativadoEm: new Date('2026-10-27T12:00:00.000Z') },
        { inativadoEm: new Date('2026-10-27T12:00:00.000Z') },
      ),
    ).toBeNull();
  });
});
