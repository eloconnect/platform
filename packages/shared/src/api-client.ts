import type {
  EsqueciSenhaRequest,
  LoginRequest,
  LoginResponse,
  MensagemResponse,
  RedefinirSenhaRequest,
} from './auth.js';
import type { HealthResponse } from './health.js';

/** Erro de uma chamada à API, com o status HTTP. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * Cliente da API do Elo Connect, usado pelo web (e depois pelo app mobile).
 * Cada endpoint novo da API ganha um método aqui, com os tipos deste pacote.
 *
 * @param baseUrl URL base da API, com o prefixo /api (ex.: "/api").
 */
export function createApiClient(
  baseUrl: string,
  // Arrow function para não perder o `this` do fetch do navegador.
  fetchImpl: Fetch = (input, init) => fetch(input, init),
) {
  async function requisitar<T>(
    metodo: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    caminho: string,
    corpo?: unknown,
  ): Promise<T> {
    const resposta = await fetchImpl(`${baseUrl}${caminho}`, {
      method: metodo,
      headers: {
        Accept: 'application/json',
        ...(corpo === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      credentials: 'include',
    });
    if (!resposta.ok) {
      throw new ApiError(
        resposta.status,
        `A API respondeu ${resposta.status} em ${metodo} ${caminho}`,
      );
    }
    // O formato da resposta é garantido pelo contrato da API (tipos deste pacote).
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return (await resposta.json()) as T;
  }

  return {
    getHealth: () => requisitar<HealthResponse>('GET', '/health'),
    login: (dados: LoginRequest) =>
      requisitar<LoginResponse>('POST', '/auth/login', dados),
    solicitarRecuperacaoSenha: (dados: EsqueciSenhaRequest) =>
      requisitar<MensagemResponse>('POST', '/auth/esqueci-senha', dados),
    redefinirSenha: (dados: RedefinirSenhaRequest) =>
      requisitar<MensagemResponse>('POST', '/auth/redefinir-senha', dados),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
