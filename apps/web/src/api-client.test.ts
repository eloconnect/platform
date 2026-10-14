import { ApiError, createApiClient } from '@eloconnect/shared';
import { describe, expect, it, vi } from 'vitest';

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

describe('createApiClient', () => {
  it('chama GET {baseUrl}/health', async () => {
    const corpo = {
      status: 'ok',
      database: 'ok',
      timestamp: '2026-01-01T00:00:00Z',
    };
    const fetchFalso = vi
      .fn<Fetch>()
      .mockResolvedValue(new Response(JSON.stringify(corpo)));
    const cliente = createApiClient('/api', fetchFalso);

    await expect(cliente.getHealth()).resolves.toEqual(corpo);
    expect(fetchFalso).toHaveBeenCalledWith(
      '/api/health',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('chama POST /auth/login com o corpo em JSON', async () => {
    const resposta = {
      accessToken: 'jwt',
      usuario: { id: '1', email: 'a@b.c', nome: 'A', perfil: 'ASSOCIADO' },
    };
    const fetchFalso = vi
      .fn<Fetch>()
      .mockResolvedValue(new Response(JSON.stringify(resposta)));
    const cliente = createApiClient('/api', fetchFalso);

    await expect(
      cliente.login({ email: 'a@b.c', senha: 'x' }),
    ).resolves.toEqual(resposta);
    expect(fetchFalso).toHaveBeenCalledWith(
      '/api/auth/login',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'a@b.c', senha: 'x' }),
      }),
    );
  });

  it('lança ApiError com o status quando a API responde erro', async () => {
    const fetchFalso = vi
      .fn<Fetch>()
      .mockResolvedValue(new Response('{}', { status: 503 }));
    const cliente = createApiClient('/api', fetchFalso);

    await expect(cliente.getHealth()).rejects.toMatchObject({ status: 503 });
    await expect(cliente.getHealth()).rejects.toBeInstanceOf(ApiError);
  });

  it('envia CSV de associados e retorna o resultado da importação', async () => {
    const resultado = { total: 2, criados: 1, atualizados: 1 };
    const fetchFalso = vi
      .fn<Fetch>()
      .mockResolvedValue(new Response(JSON.stringify(resultado)));
    const cliente = createApiClient('/api', fetchFalso);
    const arquivo = new File(['csv'], 'farmacias.csv', { type: 'text/csv' });

    await expect(
      cliente.admin.importarAssociadosCsv('jwt', arquivo),
    ).resolves.toEqual(resultado);
    expect(fetchFalso).toHaveBeenCalledWith(
      '/api/admin/associados/importar',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData),
      }),
    );
  });

  it('baixa o PDF do histórico completo do associado', async () => {
    const pdf = new Blob(['%PDF-1.7'], { type: 'application/pdf' });
    const fetchFalso = vi
      .fn<Fetch>()
      .mockResolvedValue(
        new Response(pdf, { headers: { 'Content-Type': 'application/pdf' } }),
      );
    const cliente = createApiClient('/api', fetchFalso);

    await expect(
      cliente.admin.exportarHistoricoPdf('jwt', 'id/associado'),
    ).resolves.toBeInstanceOf(Blob);
    expect(fetchFalso).toHaveBeenCalledWith(
      '/api/admin/associados/id%2Fassociado/historico.pdf',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('baixa o PDF com a lista estadual completa de farmácias', async () => {
    const pdf = new Blob(['%PDF-1.7'], { type: 'application/pdf' });
    const fetchFalso = vi.fn<Fetch>().mockResolvedValue(new Response(pdf));
    const cliente = createApiClient('/api', fetchFalso);

    await expect(
      cliente.admin.exportarListaAssociadosPdf('jwt'),
    ).resolves.toBeInstanceOf(Blob);
    expect(fetchFalso).toHaveBeenCalledWith(
      '/api/admin/associados.pdf',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('solicita PDF dos recebimentos pelo período e filtro selecionados', async () => {
    const pdf = new Blob(['%PDF-1.7'], { type: 'application/pdf' });
    const fetchFalso = vi.fn<Fetch>().mockResolvedValue(new Response(pdf));
    const cliente = createApiClient('/api', fetchFalso);

    await expect(
      cliente.admin.exportarRecebimentosPdf('jwt', 'mes', '2026-10', true),
    ).resolves.toBeInstanceOf(Blob);
    expect(fetchFalso).toHaveBeenCalledWith(
      '/api/admin/relatorios/recebimentos.pdf?periodo=mes&referencia=2026-10&inadimplentes=true',
      expect.objectContaining({ method: 'GET' }),
    );
  });
});
