import { Link } from 'react-router';
import { useTituloPagina } from '../../componentes';

export function PaginaNaoEncontrada() {
  useTituloPagina('Página não encontrada');
  return (
    <>
      <h1>Página não encontrada</h1>
      <p>O endereço digitado não existe.</p>
      <Link to="/">Voltar para o início</Link>
    </>
  );
}
