import Container from 'react-bootstrap/Container';
import { Link, Outlet } from 'react-router';

/** Layout compacto de acesso e cadastro, separado da navegação da vitrine. */
export function LayoutAutenticacao() {
  return (
    <div className="layout-autenticacao">
      <a
        href="#conteudo-autenticacao"
        className="visually-hidden-focusable link-pular"
      >
        Pular para o conteúdo
      </a>
      <main id="conteudo-autenticacao" className="conteudo-autenticacao">
        <Container>
          <Outlet />
          <Link className="voltar-vitrine" to="/">
            Voltar para a página inicial
          </Link>
        </Container>
      </main>
      <footer className="rodape-autenticacao">
        © 2026 Elo Connect · Sindicato das Farmácias e Drogarias de Mato Grosso
      </footer>
    </div>
  );
}
