import type { Perfil } from '@eloconnect/shared';
import { salvarSessao } from '../sessao';

/** Sessão de teste com o perfil pedido. */
export function entrarComo(perfil: Perfil) {
  salvarSessao({
    accessToken: 'token',
    usuario: { id: 'id', email: 'teste@example.com', nome: 'Teste', perfil },
  });
}
