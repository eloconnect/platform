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

  it('guarda no ApiError o campo informado pela API', async () => {
    const fetchFalso = vi
      .fn<Fetch>()
      .mockResolvedValueOnce(
        new Response('{"message":"x","campo":"email"}', { status: 409 }),
      )
      .mockResolvedValueOnce(new Response('não é JSON', { status: 500 }));
    const cliente = createApiClient('/api', fetchFalso);

    await expect(cliente.getHealth()).rejects.toMatchObject({
      status: 409,
      campo: 'email',
    });
    await expect(cliente.getHealth()).rejects.toMatchObject({
      status: 500,
      campo: undefined,
    });
  });

  it('manda o token da sessão no cabeçalho Authorization', async () => {
    const fetchFalso = vi
      .fn<Fetch>()
      .mockResolvedValue(new Response(JSON.stringify({})));
    const cliente = createApiClient('/api', fetchFalso, {
      obterToken: () => 'token-da-sessao',
    });

    await cliente.getHealth();
    expect(fetchFalso.mock.calls[0][1]?.headers).toMatchObject({
      Authorization: 'Bearer token-da-sessao',
    });
  });

  it('avisa quando a API recusa o token (401)', async () => {
    const fetchFalso = vi
      .fn<Fetch>()
      .mockResolvedValue(new Response('{}', { status: 401 }));
    const aoNaoAutorizado = vi.fn<() => void>();
    const cliente = createApiClient('/api', fetchFalso, {
      obterToken: () => 'token-vencido',
      aoNaoAutorizado,
    });

    await expect(cliente.getHealth()).rejects.toMatchObject({ status: 401 });
    expect(aoNaoAutorizado).toHaveBeenCalledOnce();
  });

  it('não avisa no 401 de uma chamada sem token, como o login', async () => {
    const fetchFalso = vi
      .fn<Fetch>()
      .mockResolvedValue(new Response('{}', { status: 401 }));
    const aoNaoAutorizado = vi.fn<() => void>();
    const cliente = createApiClient('/api', fetchFalso, {
      obterToken: () => null,
      aoNaoAutorizado,
    });

    await expect(
      cliente.login({ email: 'teste@example.com', senha: 'errada' }),
    ).rejects.toMatchObject({ status: 401 });
    expect(aoNaoAutorizado).not.toHaveBeenCalled();
  });

  it('lista associados só com os filtros informados', async () => {
    const fetchFalso = vi
      .fn<Fetch>()
      .mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify({}))),
      );
    const cliente = createApiClient('/api', fetchFalso);

    await cliente.listarAssociados();
    await cliente.listarAssociados({
      busca: 'farmácia 01',
      status: 'ADIMPLENTE',
      contribuicaoAtiva: false,
      incluirInativos: undefined,
      pagina: 2,
    });
    expect(fetchFalso.mock.calls.map(([url]) => url)).toEqual([
      '/api/associados',
      '/api/associados?busca=farm%C3%A1cia+01&status=ADIMPLENTE&contribuicaoAtiva=false&pagina=2',
    ]);
  });

  it('busca o perfil do associado pelo id', async () => {
    const fetchFalso = vi
      .fn<Fetch>()
      .mockResolvedValue(new Response(JSON.stringify({})));
    const cliente = createApiClient('/api', fetchFalso);

    await cliente.buscarAssociado('id-01');
    expect(fetchFalso).toHaveBeenCalledWith(
      '/api/associados/id-01',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('cadastra, edita, inativa e reativa associados', async () => {
    const fetchFalso = vi
      .fn<Fetch>()
      .mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify({}))),
      );
    const cliente = createApiClient('/api', fetchFalso);
    const dados = { cnpj: '11222333000181', razaoSocial: 'Farmácia Teste' };

    await cliente.criarAssociado(dados);
    await cliente.editarAssociado('id-01', { razaoSocial: 'Outro nome' });
    await cliente.inativarAssociado('id-01');
    await cliente.reativarAssociado('id-01');
    expect(
      fetchFalso.mock.calls.map(([url, init]) => [
        url,
        init?.method,
        init?.body,
      ]),
    ).toEqual([
      ['/api/associados', 'POST', JSON.stringify(dados)],
      [
        '/api/associados/id-01',
        'PATCH',
        JSON.stringify({ razaoSocial: 'Outro nome' }),
      ],
      ['/api/associados/id-01/inativar', 'POST', undefined],
      ['/api/associados/id-01/reativar', 'POST', undefined],
    ]);
  });
});
