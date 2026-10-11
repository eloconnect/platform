import { createApiClient } from '@eloconnect/shared';

/** Cliente da API. Em desenvolvimento, /api é encaminhado pelo Vite. */
export const api = createApiClient(import.meta.env.VITE_API_URL ?? '/api');
