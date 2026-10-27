export type { HealthResponse } from './health.js';
export type * from './auth.js';
export {
  ApiError,
  createApiClient,
  type ApiClient,
  type OpcoesApiClient,
} from './api-client.js';
export {
  podeAcessarRecursoRestrito,
  type SituacaoAcesso,
  type AcessoManualStatus,
} from './access-policy.js';
