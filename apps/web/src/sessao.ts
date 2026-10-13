import type { LoginResponse } from '@eloconnect/shared';

const CHAVE = 'eloconnect.sessao';

/**
 * Guarda a sessão no navegador: só até fechar a aba, ou neste dispositivo
 * quando o usuário marca "Lembrar neste dispositivo".
 */
export function salvarSessao(sessao: LoginResponse, lembrar: boolean): void {
  limparSessao();
  (lembrar ? localStorage : sessionStorage).setItem(
    CHAVE,
    JSON.stringify(sessao),
  );
}

export function lerSessao(): LoginResponse | null {
  const bruto = localStorage.getItem(CHAVE) ?? sessionStorage.getItem(CHAVE);
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
  localStorage.removeItem(CHAVE);
  sessionStorage.removeItem(CHAVE);
}

export function destinoPorPerfil(perfil: LoginResponse['usuario']['perfil']) {
  return perfil === 'ADMIN' ? '/admin' : '/associado';
}
