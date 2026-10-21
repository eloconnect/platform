import { useEffect, useRef } from 'react';
import Container from 'react-bootstrap/Container';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import { Link, NavLink, Outlet, useLocation } from 'react-router';

export interface ItemMenu {
  para: string;
  texto: string;
  ancora?: boolean;
}
export function LayoutBase({
  inicio,
  itensMenu,
  acaoPrimaria,
  expand = 'lg',
}: {
  inicio: string;
  itensMenu: ItemMenu[];
  acaoPrimaria?: ItemMenu;
  expand?: 'md' | 'lg' | 'xl';
}) {
  const { pathname } = useLocation();

  const principal = useRef<HTMLElement>(null);
  const caminhoAnterior = useRef(pathname);

  useEffect(() => {
    if (caminhoAnterior.current === pathname) return;

    caminhoAnterior.current = pathname;
    principal.current?.focus();
  }, [pathname]);

  return (
    <div className="aplicativo">
      <a href="#conteudo" className="visually-hidden-focusable link-pular">
        Pular para o conteúdo
      </a>

      <header className="site-header">
        <Navbar
          expand={expand}
          bg="white"
          className="primary-nav py-2 w-100"
          collapseOnSelect
        >
          <div className="cabecalho-container">
            <Navbar.Brand
              as={Link}
              to={inicio}
              className="marca-elo text-decoration-none p-0"
            >
              <span className="logo-elo-connect" aria-hidden="true">
                <img src="/images/logo.png" alt="" />
              </span>

              <span className="nome-elo fw-bold text-primary">Elo Connect</span>
            </Navbar.Brand>

            <Navbar.Toggle
              className="menu-mobile-toggle"
              aria-controls="menu-principal"
              aria-label="Abrir ou fechar menu de navegação"
            />

            <Navbar.Collapse id="menu-principal" className="menu-recolhivel">
              <Nav
                as="nav"
                aria-label="Menu principal"
                className="menu-principal"
              >
                {itensMenu.map((item) =>
                  item.ancora ? (
                    <Nav.Link key={item.texto} href={`${inicio}${item.para}`}>
                      {item.texto}
                    </Nav.Link>
                  ) : (
                    <Nav.Link key={item.texto} as={NavLink} to={item.para} end>
                      {item.texto}
                    </Nav.Link>
                  ),
                )}
              </Nav>

              {acaoPrimaria && (
                <Link
                  className="btn btn-primary btn-lg acao-cabecalho"
                  to={acaoPrimaria.para}
                >
                  {acaoPrimaria.texto}
                </Link>
              )}
            </Navbar.Collapse>
          </div>
        </Navbar>
      </header>

      <main
        id="conteudo"
        ref={principal}
        tabIndex={-1}
        className={`pagina-principal py-4 py-lg-5 ${
          pathname === '/' ? 'pagina-principal-vitrine' : ''
        }`}
      >
        <Container
          className={pathname === '/' ? 'container-vitrine' : undefined}
        >
          <Outlet />
        </Container>
      </main>

      <footer className="site-footer py-3">
        <Container className="text-center">
          <small>
            Elo Connect · Sindicato das farmácias e drogarias de Mato Grosso
          </small>
        </Container>
      </footer>
    </div>
  );
}
