import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import type { Perfil } from '@eloconnect/shared';
import { destinoPorPerfil, lerSessao } from '../sessao';

/**
 * Mostra a área só para quem entrou com o perfil dela. Sem sessão, vai para o
 * login; com o outro perfil, vai para a própria área. O token vencido é
 * tratado pelo cliente da API, que encerra a sessão no primeiro 401.
 */
export function RotaProtegida({
  perfil,
  children,
}: {
  perfil: Perfil;
  children: ReactNode;
}) {
  const sessao = lerSessao();
  if (!sessao) {
    return <Navigate to="/entrar" replace />;
  }
  if (sessao.usuario.perfil !== perfil) {
    return <Navigate to={destinoPorPerfil(sessao.usuario.perfil)} replace />;
  }
  return children;
}
