import type {
  Associado,
  AssociadoDetalhe,
  CriarAssociadoRequest,
  DefinirAcessoRequest,
  EditarAssociadoRequest,
  FiltrosAssociados,
  ListaAssociados,
  MinhaConta,
} from './associados.js';
import type {
  FiltrosLogAuditoria,
  ListaLogAuditoria,
  UsuarioSede,
} from './auditoria.js';
import type {
  ConfirmarContaRequest,
  CriarContaRequest,
  EsqueciSenhaRequest,
  LoginRequest,
  LoginResponse,
  MensagemResponse,
  RedefinirSenhaRequest,
} from './auth.js';
import type {
  Beneficio,
  CriarBeneficioRequest,
  EditarBeneficioRequest,
} from './beneficios.js';
import type {
  Convencao,
  CriarConvencaoRequest,
  EditarConvencaoRequest,
} from './convencoes.js';
import type { HealthResponse } from './health.js';
import type {
  EditarNoticiaRequest,
  Noticia,
  PublicarNoticiaRequest,
} from './noticias.js';
import type { AlterarValorRequest, PainelValores } from './valores.js';

/**
 * Erro de uma chamada à API, com o status HTTP e, quando a API informa, o
 * campo do formulário que causou o erro (ex.: "email").
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly campo?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** O campo do erro, se a resposta for JSON com `campo` em texto. */
async function campoDoErro(resposta: Response): Promise<string | undefined> {
  try {
    const corpo: unknown = await resposta.json();
    return typeof corpo === 'object' &&
      corpo !== null &&
      'campo' in corpo &&
      typeof corpo.campo === 'string'
      ? corpo.campo
      : undefined;
  } catch {
    return undefined;
  }
}

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export interface OpcoesApiClient {
  /** Token da sessão, enviado em `Authorization: Bearer`. */
  obterToken?: () => string | null;

  /**
   * Chamado quando a API recusa o token (401), por exemplo depois que ele
   * vence. Chamadas sem token, como o login com a senha errada, não chamam.
   */
  aoNaoAutorizado?: () => void;
}

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
  { obterToken, aoNaoAutorizado }: OpcoesApiClient = {},
) {
  async function requisitar<T>(
    metodo: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    caminho: string,
    corpo?: unknown,
  ): Promise<T> {
    const token = obterToken?.() ?? null;

    const resposta = await fetchImpl(`${baseUrl}${caminho}`, {
      method: metodo,
      headers: {
        Accept: 'application/json',
        ...(corpo === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      credentials: 'include',
    });

    if (resposta.status === 401 && token) {
      aoNaoAutorizado?.();
    }

    if (!resposta.ok) {
      throw new ApiError(
        resposta.status,
        `A API respondeu ${resposta.status} em ${metodo} ${caminho}`,
        await campoDoErro(resposta),
      );
    }

    // O formato da resposta é garantido pelo contrato da API.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return (await resposta.json()) as T;
  }

  /**
   * Envia arquivos usando multipart/form-data.
   * O navegador define automaticamente o Content-Type e seu boundary.
   */
  async function requisitarMultipart<T>(
    caminho: string,
    corpo: FormData,
  ): Promise<T> {
    const token = obterToken?.() ?? null;

    const resposta = await fetchImpl(`${baseUrl}${caminho}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: corpo,
      credentials: 'include',
    });

    if (resposta.status === 401 && token) {
      aoNaoAutorizado?.();
    }

    if (!resposta.ok) {
      throw new ApiError(
        resposta.status,
        `A API respondeu ${resposta.status} em POST ${caminho}`,
        await campoDoErro(resposta),
      );
    }

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

    criarConta: (dados: CriarContaRequest) =>
      requisitar<MensagemResponse>('POST', '/auth/criar-conta', dados),

    confirmarConta: (dados: ConfirmarContaRequest) =>
      requisitar<MensagemResponse>('POST', '/auth/confirmar-conta', dados),

    listarAssociados: (filtros: FiltrosAssociados = {}) =>
      requisitar<ListaAssociados>(
        'GET',
        `/associados${montarQuery({ ...filtros })}`,
      ),

    buscarAssociado: (id: string) =>
      requisitar<AssociadoDetalhe>(
        'GET',
        `/associados/${encodeURIComponent(id)}`,
      ),

    criarAssociado: (dados: CriarAssociadoRequest) =>
      requisitar<Associado>('POST', '/associados', dados),

    editarAssociado: (id: string, dados: EditarAssociadoRequest) =>
      requisitar<Associado>(
        'PATCH',
        `/associados/${encodeURIComponent(id)}`,
        dados,
      ),

    inativarAssociado: (id: string) =>
      requisitar<Associado>(
        'POST',
        `/associados/${encodeURIComponent(id)}/inativar`,
      ),

    reativarAssociado: (id: string) =>
      requisitar<Associado>(
        'POST',
        `/associados/${encodeURIComponent(id)}/reativar`,
      ),

    minhaConta: () => requisitar<MinhaConta>('GET', '/minha-conta'),

    definirAcesso: (id: string, dados: DefinirAcessoRequest) =>
      requisitar<Associado>(
        'PUT',
        `/associados/${encodeURIComponent(id)}/acesso`,
        dados,
      ),

    listarLogAuditoria: (filtros: FiltrosLogAuditoria = {}) =>
      requisitar<ListaLogAuditoria>(
        'GET',
        `/auditoria${montarQuery({ ...filtros })}`,
      ),

    listarUsuariosSede: () =>
      requisitar<UsuarioSede[]>('GET', '/auditoria/usuarios'),

    painelValores: () => requisitar<PainelValores>('GET', '/valores'),

    alterarValor: (dados: AlterarValorRequest) =>
      requisitar<PainelValores>('POST', '/valores', dados),

    listarBeneficios: () => requisitar<Beneficio[]>('GET', '/beneficios'),

    criarBeneficio: (dados: CriarBeneficioRequest) =>
      requisitar<Beneficio>('POST', '/beneficios', dados),

    editarBeneficio: (id: string, dados: EditarBeneficioRequest) =>
      requisitar<Beneficio>(
        'PATCH',
        `/beneficios/${encodeURIComponent(id)}`,
        dados,
      ),

    removerBeneficio: (id: string) =>
      requisitar<Beneficio>('DELETE', `/beneficios/${encodeURIComponent(id)}`),

    listarNoticias: () => requisitar<Noticia[]>('GET', '/noticias'),

    publicarNoticia: (dados: PublicarNoticiaRequest) =>
      requisitar<Noticia>('POST', '/noticias', dados),

    editarNoticia: (id: string, dados: EditarNoticiaRequest) =>
      requisitar<Noticia>(
        'PATCH',
        `/noticias/${encodeURIComponent(id)}`,
        dados,
      ),

    removerNoticia: (id: string) =>
      requisitar<Noticia>('DELETE', `/noticias/${encodeURIComponent(id)}`),

    listarConvencoes: () => requisitar<Convencao[]>('GET', '/convencoes'),

    criarConvencao: (dados: CriarConvencaoRequest) =>
      requisitar<Convencao>('POST', '/convencoes', dados),

    editarConvencao: (id: string, dados: EditarConvencaoRequest) =>
      requisitar<Convencao>(
        'PATCH',
        `/convencoes/${encodeURIComponent(id)}`,
        dados,
      ),

    atualizarAnexosConvencao: (id: string, arquivos: FormData) =>
      requisitarMultipart<Convencao>(
        `/convencoes/${encodeURIComponent(id)}/anexos`,
        arquivos,
      ),

    publicarConvencao: (id: string) =>
      requisitar<Convencao>(
        'POST',
        `/convencoes/${encodeURIComponent(id)}/publicar`,
      ),

    removerConvencao: (id: string) =>
      requisitar<Convencao>('DELETE', `/convencoes/${encodeURIComponent(id)}`),
  };
}

/** "?chave=valor&..." só com os valores informados; vazio se não houver nenhum. */
function montarQuery(
  parametros: Record<string, string | number | boolean | undefined>,
): string {
  const query = new URLSearchParams();

  for (const [chave, valor] of Object.entries(parametros)) {
    if (valor !== undefined && valor !== '') {
      query.set(chave, String(valor));
    }
  }

  const texto = query.toString();
  return texto ? `?${texto}` : '';
}

export type ApiClient = ReturnType<typeof createApiClient>;
