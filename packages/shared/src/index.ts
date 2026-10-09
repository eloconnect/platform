export interface HealthResponse {
  status: 'ok';
  database: 'ok' | 'erro';
  timestamp: string;
}
