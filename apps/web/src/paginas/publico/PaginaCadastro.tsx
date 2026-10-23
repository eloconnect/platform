import { Link } from 'react-router';
import { useTituloPagina } from '../../componentes';

export function PaginaCadastro() {
  useTituloPagina('Cadastro em construção');

  return (
    <main className="container py-5">
      <section aria-labelledby="titulo-cadastro">
        <h1 id="titulo-cadastro" className="h2 mb-3">
          Cadastro em construção
        </h1>

        <p className="lead">
          A funcionalidade de cadastro será disponibilizada em uma próxima etapa
          do Elo Connect.
        </p>

        <p>O fluxo completo de cadastro está previsto na issue #61.</p>

        <Link to="/" className="btn btn-primary">
          Voltar à página inicial
        </Link>
      </section>
    </main>
  );
}
