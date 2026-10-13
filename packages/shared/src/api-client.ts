import type {
  BeneficioAssociado,
  ConvencaoAssociado,
  HistoricoAssociado,
  NoticiaAssociado,
  PainelAssociado,
} from './associado.js';
import type {
  CancelamentoPendente,
  ConvencaoPublicada,
  FichaAssociado,
  ListaAssociados,
  ResumoAdmin,
  ValoresAdmin,
} from './admin.js';
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
    token?: string,
  ): Promise<T> {
    const resposta = await fetchImpl(`${baseUrl}${caminho}`, {
      method: metodo,
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
    admin: {
      resumo: (token: string) =>
        requisitar<ResumoAdmin>('GET', '/admin/resumo', undefined, token),
      associados: (token: string, busca: string, pagina: number) =>
        requisitar<ListaAssociados>(
          'GET',
          `/admin/associados?busca=${encodeURIComponent(busca)}&pagina=${pagina}`,
          undefined,
          token,
        ),
      ficha: (token: string, id: string) =>
        requisitar<FichaAssociado>(
          'GET',
          `/admin/associados/${encodeURIComponent(id)}`,
          undefined,
          token,
        ),
      valores: (token: string) =>
        requisitar<ValoresAdmin>('GET', '/admin/valores', undefined, token),
      cancelamentos: (token: string) =>
        requisitar<CancelamentoPendente[]>(
          'GET',
          '/admin/cancelamentos',
          undefined,
          token,
        ),
      propor: (token: string, valorMensal: number) =>
        requisitar<ValoresAdmin>(
          'POST',
          '/admin/valores',
          { valorMensal },
          token,
        ),
      aprovarCancelamento: (token: string, id: string) =>
        requisitar<CancelamentoPendente[]>(
          'POST',
          `/admin/cancelamentos/${encodeURIComponent(id)}/aprovar`,
          {},
          token,
        ),
      definirAcesso: (token: string, id: string, bloqueado: boolean) =>
        requisitar<FichaAssociado>(
          'POST',
          `/admin/associados/${encodeURIComponent(id)}/acesso`,
          { bloqueado },
          token,
        ),
      convencoes: (token: string) =>
        requisitar<ConvencaoPublicada[]>(
          'GET',
          '/admin/convencoes',
          undefined,
          token,
        ),
    },
    associado: {
      painel: (token: string) =>
        requisitar<PainelAssociado>(
          'GET',
          '/associado/painel',
          undefined,
          token,
        ),
      historico: (token: string) =>
        requisitar<HistoricoAssociado>(
          'GET',
          '/associado/historico',
          undefined,
          token,
        ),
      convencoes: (token: string) =>
        requisitar<ConvencaoAssociado[]>(
          'GET',
          '/associado/convencoes',
          undefined,
          token,
        ),
      noticias: (token: string) =>
        requisitar<NoticiaAssociado[]>(
          'GET',
          '/associado/noticias',
          undefined,
          token,
        ),
      beneficios: (token: string) =>
        requisitar<BeneficioAssociado[]>(
          'GET',
          '/associado/beneficios',
          undefined,
          token,
        ),
      definirRecorrencia: (token: string, ativo: boolean) =>
        requisitar<PainelAssociado>(
          'POST',
          '/associado/recorrencia',
          { ativo },
          token,
        ),
      solicitarCancelamento: (token: string, motivo?: string) =>
        requisitar<PainelAssociado>(
          'POST',
          '/associado/cancelamento',
          { motivo },
          token,
        ),
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
