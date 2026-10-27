import { createApiClient } from '@eloconnect/shared';
import { lerToken, limparSessao } from './sessao';

/** Cliente da API. Em desenvolvimento, /api é encaminhado pelo Vite. */
export const api = createApiClient(
  import.meta.env.VITE_API_URL ?? '/api',
  undefined,
  {
    obterToken: lerToken,
    // Token vencido ou recusado: encerra a sessão e volta para o login.
    aoNaoAutorizado: () => {
      limparSessao();
      window.location.assign('/entrar');
    },
  },
);
