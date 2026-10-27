import { useEffect, useRef } from 'react';
import Container from 'react-bootstrap/Container';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import { Link, NavLink, Outlet, useLocation } from 'react-router';

export interface ItemMenu {
  para: string;
  texto: string;
  /** Executado ao clicar, antes de navegar (ex.: encerrar a sessão no "Sair"). */
  aoClicar?: () => void;
}

/**
 * Estrutura comum às três áreas: link para pular ao conteúdo, cabeçalho com
 * menu em texto (sem ícones soltos), conteúdo principal e rodapé.
 */
export function LayoutBase({
  inicio,
  itensMenu,
}: {
  /** Para onde o nome "Elo Connect" no cabeçalho leva. */
  inicio: string;
  itensMenu: ItemMenu[];
}) {
  const { pathname } = useLocation();
  const principal = useRef<HTMLElement>(null);
  const caminhoAnterior = useRef(pathname);

  // Ao trocar de página, leva o foco ao conteúdo, para o leitor de tela
  // começar a leitura pela página nova (e não pelo menu de novo).
  // Compara com o caminho anterior para não roubar o foco no carregamento.
  useEffect(() => {
    if (caminhoAnterior.current === pathname) return;
    caminhoAnterior.current = pathname;
    principal.current?.focus();
  }, [pathname]);

  return (
    <>
      <a href="#conteudo" className="visually-hidden-focusable link-pular">
        Pular para o conteúdo
      </a>
      <header>
        <Navbar expand="md" bg="white" className="border-bottom">
          <Container>
            <Navbar.Brand
              as={Link}
              to={inicio}
              className="fw-bold text-primary"
            >
              Elo Connect
            </Navbar.Brand>
            <Navbar.Toggle aria-controls="menu-principal">Menu</Navbar.Toggle>
            <Navbar.Collapse id="menu-principal">
              <Nav as="nav" aria-label="Menu principal" className="ms-auto">
                {itensMenu.map((item) => (
                  <Nav.Link
                    key={item.para}
                    as={NavLink}
                    to={item.para}
                    end
                    onClick={item.aoClicar}
                  >
                    {item.texto}
                  </Nav.Link>
                ))}
              </Nav>
            </Navbar.Collapse>
          </Container>
        </Navbar>
      </header>
      <main id="conteudo" ref={principal} tabIndex={-1} className="py-4">
        <Container>
          <Outlet />
        </Container>
      </main>
      <footer className="border-top py-3 bg-body-tertiary">
        <Container>
          <small>
            Elo Connect · Sindicato das farmácias e drogarias de Mato Grosso
          </small>
        </Container>
      </footer>
    </>
  );
}
