import { Link } from 'react-router';
import { useTituloPagina } from '../../componentes';

export function PaginaNaoEncontrada() {
  useTituloPagina('Página não encontrada');
  return (
    <section className="cartao-pagina">
      <span className="pagina-selo">Elo Connect</span>
      <h1>Página não encontrada</h1>
      <p className="pagina-descricao">O endereço digitado não existe.</p>
      <Link className="btn btn-primary btn-lg" to="/">
        Voltar para o início
      </Link>
    </section>
  );
}
