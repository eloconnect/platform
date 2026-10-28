import type { LoginResponse } from '@eloconnect/shared';

const CHAVE = 'eloconnect.sessao';

/**
 * Guarda a sessão no navegador, só até fechar a aba. O token vale 1 hora, então
 * não há sessão persistente entre visitas.
 */
export function salvarSessao(sessao: LoginResponse): void {
  sessionStorage.setItem(CHAVE, JSON.stringify(sessao));
}

export function lerSessao(): LoginResponse | null {
  const bruto = sessionStorage.getItem(CHAVE);
  if (!bruto) return null;
  try {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return JSON.parse(bruto) as LoginResponse;
  } catch {
    return null;
  }
}

export function lerToken(): string | null {
  return lerSessao()?.accessToken ?? null;
}

export function limparSessao(): void {
  sessionStorage.removeItem(CHAVE);
}

export function destinoPorPerfil(perfil: LoginResponse['usuario']['perfil']) {
  return perfil === 'ASSOCIADO' ? '/associado' : '/admin';
}

/** Só o perfil chave mestre da sede altera cadastro, acesso e cobrança (RN33). */
export function ehChaveMestre(): boolean {
  return lerSessao()?.usuario.perfil === 'ADMIN';
}
