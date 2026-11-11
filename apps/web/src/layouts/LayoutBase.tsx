import { useEffect, useId, useRef } from 'react';
import Container from 'react-bootstrap/Container';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { Icone, TamanhoLetra, type NomeIcone } from '../componentes';

export interface ItemMenu {
  para: string;
  texto: string;
  /** Sempre ao lado do texto, nunca sozinho (RNF02). */
  icone?: NomeIcone;
  /** Mostra o item como botão, para a ação principal do menu. */
  destaque?: boolean;
  /** Executado ao clicar, antes de navegar (ex.: encerrar a sessão no "Sair"). */
  aoClicar?: () => void;
}

/**
 * Ao trocar de página, leva o foco ao conteúdo, para o leitor de tela começar
 * a leitura pela página nova (e não pelo menu de novo). Compara com o caminho
 * anterior para não roubar o foco no carregamento.
 */
export function useFocoAoNavegar() {
  const { pathname } = useLocation();
  const principal = useRef<HTMLElement>(null);
  const caminhoAnterior = useRef(pathname);

  useEffect(() => {
    if (caminhoAnterior.current === pathname) return;
    caminhoAnterior.current = pathname;
    principal.current?.focus();
  }, [pathname]);

  return principal;
}

/**
 * Símbolo do Elo Connect, enquanto o sindicato não tem identidade própria:
 * dois elos entrelaçados. Cada máscara abre um vão num elo onde o outro passa
 * por cima (no alto, o da esquerda; embaixo, o da direita).
 */
export function DesenhoMarca() {
  const id = useId();
  return (
    <svg
      viewBox="0 0 40 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      aria-hidden="true"
    >
      <mask id={`${id}-a`} maskUnits="userSpaceOnUse">
        <rect width="40" height="24" fill="#fff" />
        <circle cx="20" cy="18.93" r="3.1" fill="#000" />
      </mask>
      <mask id={`${id}-b`} maskUnits="userSpaceOnUse">
        <rect width="40" height="24" fill="#fff" />
        <circle cx="20" cy="5.07" r="3.1" fill="#000" />
      </mask>
      <rect x="4" y="4" width="20" height="16" rx="8" mask={`url(#${id}-a)`} />
      <rect x="16" y="4" width="20" height="16" rx="8" mask={`url(#${id}-b)`} />
    </svg>
  );
}

/** Nome da marca, com "Elo" mais forte. O texto lido continua "Elo Connect". */
export function NomeMarca() {
  return (
    <span>
      <span className="elo-marca-elo">Elo</span> Connect
    </span>
  );
}

export function LinkPularConteudo() {
  return (
    <a href="#conteudo" className="visually-hidden-focusable link-pular">
      Pular para o conteúdo
    </a>
  );
}

/**
 * Estrutura da área pública e da área do associado: link para pular ao
 * conteúdo, cabeçalho com menu em texto, conteúdo principal e rodapé.
 */
export function LayoutBase({
  inicio,
  itensMenu,
  moldeAssociado = false,
}: {
  /** Para onde o nome "Elo Connect" no cabeçalho leva. */
  inicio: string;
  itensMenu: ItemMenu[];
  /**
   * Molde das páginas do associado: coluna de leitura e, fora do início, o
   * "Voltar para o início" sempre no mesmo lugar. O início serve de menu.
   */
  moldeAssociado?: boolean;
}) {
  const principal = useFocoAoNavegar();
  const { pathname } = useLocation();
  // A página inicial tem faixas de ponta a ponta e cuida da própria largura.
  const larguraTotal = pathname === '/';
  // A key refaz a entrada suave do conteúdo a cada página.
  const conteudo = (
    <div key={pathname} className="elo-entrada">
      {moldeAssociado && pathname !== inicio && (
        <Link to={inicio} className="elo-voltar">
          <Icone nome="seta" />
          Voltar para o início
        </Link>
      )}
      <Outlet />
    </div>
  );

  return (
    <>
      <LinkPularConteudo />
      <header>
        <div className="elo-barra-letra">
          <Container>
            <TamanhoLetra />
          </Container>
        </div>
        <Navbar
          expand="lg"
          bg="white"
          collapseOnSelect
          className="border-bottom elo-topo"
        >
          <Container>
            <Navbar.Brand as={Link} to={inicio} className="elo-marca">
              <DesenhoMarca />
              <NomeMarca />
            </Navbar.Brand>
            <Navbar.Toggle aria-controls="menu-principal">
              <Icone nome="menu" />
              Menu
            </Navbar.Toggle>
            <Navbar.Collapse id="menu-principal">
              <Nav as="nav" aria-label="Menu principal" className="ms-auto">
                {itensMenu.map((item) => (
                  <Nav.Link
                    key={item.para}
                    as={NavLink}
                    to={item.para}
                    end
                    eventKey={item.para}
                    className={item.destaque ? 'elo-item-destaque' : undefined}
                    onClick={item.aoClicar}
                  >
                    {item.icone && <Icone nome={item.icone} />}
                    {item.texto}
                  </Nav.Link>
                ))}
              </Nav>
            </Navbar.Collapse>
          </Container>
        </Navbar>
      </header>
      <main
        id="conteudo"
        ref={principal}
        tabIndex={-1}
        className={larguraTotal ? undefined : 'py-4'}
      >
        {larguraTotal ? (
          conteudo
        ) : (
          <Container className={moldeAssociado ? 'elo-coluna' : undefined}>
            {conteudo}
          </Container>
        )}
      </main>
      <footer className="elo-rodape">
        <Container>
          Elo Connect · Sindicato das farmácias e drogarias de Mato Grosso
        </Container>
      </footer>
    </>
  );
}
