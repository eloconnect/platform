import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import type { Perfil } from '@eloconnect/shared';
import { destinoPorPerfil, lerSessao } from '../sessao';

/**
 * Mostra a área só para quem entrou com um dos perfis dela. Sem sessão, vai
 * para o login; com outro perfil, vai para a própria área. O token vencido é
 * tratado pelo cliente da API, que encerra a sessão no primeiro 401.
 */
export function RotaProtegida({
  perfis,
  children,
}: {
  perfis: Perfil[];
  children: ReactNode;
}) {
  const sessao = lerSessao();
  if (!sessao) {
    return <Navigate to="/entrar" replace />;
  }
  if (!perfis.includes(sessao.usuario.perfil)) {
    return <Navigate to={destinoPorPerfil(sessao.usuario.perfil)} replace />;
  }
  return children;
}
