import { Link } from 'react-router';
import { useTituloPagina } from '../../componentes';

/** Landing page pública (US01, issue #20). */
export function PaginaInicial() {
  useTituloPagina('Início');
  // TODO(#20): conteúdo da landing page (o que o sindicato oferece).
  return (
    <>
      <h1>Elo Connect</h1>
      <p className="lead">Página inicial pública. Em construção (issue #20).</p>
      {/* Link com aparência de botão: navega sem recarregar a página. */}
      <Link to="/entrar" className="btn btn-primary btn-lg">
        Entrar
      </Link>
    </>
  );
}
