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

/**
 * Estrutura comum às três áreas: link para pular ao conteúdo, cabeçalho com
 * menu em texto (sem ícones soltos), conteúdo principal e rodapé.
 */
export function LayoutBase({
  inicio,
  itensMenu,
  acaoPrimaria,
  expand = 'md',
}: {
  /** Para onde o nome "Elo Connect" no cabeçalho leva. */
  inicio: string;
  itensMenu: ItemMenu[];
  acaoPrimaria?: ItemMenu;
  expand?: 'md' | 'lg' | 'xl';
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
    <div className="aplicativo">
      <a href="#conteudo" className="visually-hidden-focusable link-pular">
        Pular para o conteúdo
      </a>
      <header className="site-header">
        <div className="site-utility">
          <Container className="site-utility-content">
            <span>Elo Connect · Acesso Institucional</span>
            <a href="tel:08007244500">
              <span aria-hidden="true">☎</span> Central telefônica:{' '}
              <strong>0800 724 4500</strong>
            </a>
          </Container>
        </div>
        <Navbar expand={expand} bg="white" className="primary-nav">
          <Container>
            <Navbar.Brand as={Link} to={inicio} className="marca-elo">
              <span className="marca-site-icone" aria-hidden="true">
                E
              </span>
              Elo Connect
            </Navbar.Brand>
            <Navbar.Toggle aria-controls="menu-principal">Menu</Navbar.Toggle>
            <Navbar.Collapse id="menu-principal">
              <Nav
                as="nav"
                aria-label="Menu principal"
                className="menu-principal ms-auto"
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
          </Container>
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
      {pathname !== '/' && (
        <footer className="site-footer py-3">
          <Container>
            <small>
              Elo Connect · Sindicato das farmácias e drogarias de Mato Grosso
            </small>
          </Container>
        </footer>
      )}
    </div>
  );
}
