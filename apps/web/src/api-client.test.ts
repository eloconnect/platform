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

  it('lança ApiError com o status quando a API responde erro', async () => {
    const fetchFalso = vi
      .fn<Fetch>()
      .mockResolvedValue(new Response('{}', { status: 503 }));
    const cliente = createApiClient('/api', fetchFalso);

    await expect(cliente.getHealth()).rejects.toMatchObject({ status: 503 });
    await expect(cliente.getHealth()).rejects.toBeInstanceOf(ApiError);
  });
});
