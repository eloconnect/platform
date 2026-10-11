import { Link } from 'react-router';
import { useTituloPagina } from '../../componentes';

/** Login com e-mail e senha (US03, issue #17). */
export function PaginaEntrar() {
  useTituloPagina('Entrar');
  // TODO(#17): formulário de login, usando CampoTexto e Botao.
  return (
    <>
      <h1>Entrar</h1>
      <p>Tela de login. Em construção (issue #17).</p>
      <Link to="/esqueci-senha">Esqueci minha senha</Link>
    </>
  );
}
