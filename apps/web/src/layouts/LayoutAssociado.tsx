import { useEffect, useRef } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import '../estilos/associado.scss';
import { lerSessao, limparSessao } from '../sessao';

const ABAS = [
  { para: '/associado', texto: 'Boletos', fim: true },
  { para: '/associado/beneficios', texto: 'Benefícios & Suporte' },
  { para: '/associado/convencoes', texto: 'Convenções Coletivas' },
  { para: '/associado/noticias', texto: 'Notícias' },
  { para: '/associado/cancelamento', texto: 'Solicitar cancelamento' },
];

/** Portal da farmácia associada, com abas no topo. */
export function LayoutAssociado() {
  const usuario = lerSessao()?.usuario;
  const { pathname } = useLocation();
  const principal = useRef<HTMLElement>(null);
  const anterior = useRef(pathname);

  // Ao trocar de página, leva o foco ao conteúdo para o leitor de tela.
  useEffect(() => {
    if (anterior.current === pathname) return;
    anterior.current = pathname;
    principal.current?.focus();
  }, [pathname]);

  return (
    <div className="as-app">
      <a className="visually-hidden-focusable link-pular" href="#conteudo">
        Pular para o conteúdo
      </a>
      <header className="as-cabecalho">
        <div className="as-topo">
          <Link to="/associado" className="as-marca">
            <span className="as-marca-logo" aria-hidden="true">
              E
            </span>
            <span>
              <strong>Elo Connect</strong>
              <small>PORTAL SINDICAL DA FARMÁCIA</small>
            </span>
          </Link>
          <div className="as-usuario">
            <span>
              <strong>{usuario?.nome ?? 'Associado'}</strong>
              <small>{usuario?.email}</small>
            </span>
            <Link to="/" onClick={limparSessao} className="as-sair">
              Sair
            </Link>
          </div>
        </div>
        <nav aria-label="Menu do portal" className="as-abas">
          {ABAS.map((aba) => (
            <NavLink key={aba.para} to={aba.para} end={aba.fim}>
              {aba.texto}
            </NavLink>
          ))}
        </nav>
      </header>

      <main
        id="conteudo"
        tabIndex={-1}
        ref={principal}
        className="as-principal"
      >
        <Outlet />
      </main>
      <footer className="as-rodape">
        <span>Elo Connect</span>
      </footer>
    </div>
  );
}
