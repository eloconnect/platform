import { Fragment, useLayoutEffect } from 'react';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import { Link, NavLink, Outlet } from 'react-router';
import { Icone } from '../componentes';
import { ehChaveMestre, limparSessao } from '../sessao';
import {
  DesenhoMarca,
  LinkPularConteudo,
  useFocoAoNavegar,
  type ItemMenu,
} from './LayoutBase';

interface GrupoMenu {
  titulo: string;
  itens: ItemMenu[];
}

function gruposDoMenu(chaveMestre: boolean): GrupoMenu[] {
  const soChaveMestre: GrupoMenu[] = [
    {
      titulo: 'Financeiro',
      itens: [
        { para: '/admin/valores', texto: 'Valores', icone: 'valores' },
        {
          para: '/admin/cobranca-formal',
          texto: 'Cobrança formal',
          icone: 'comunicado',
        },
      ],
    },
    {
      titulo: 'Sistema',
      itens: [
        {
          para: '/admin/auditoria',
          texto: 'Histórico de ações',
          icone: 'historico',
        },
      ],
    },
  ];
  return [
    {
      titulo: 'Geral',
      itens: [
        { para: '/admin', texto: 'Painel', icone: 'painel' },
        { para: '/admin/associados', texto: 'Associados', icone: 'pessoas' },
      ],
    },
    {
      titulo: 'Conteúdo',
      itens: [
        { para: '/admin/beneficios', texto: 'Benefícios', icone: 'escudo' },
        { para: '/admin/convencoes', texto: 'Convenções', icone: 'documento' },
        { para: '/admin/noticias', texto: 'Notícias', icone: 'noticia' },
      ],
    },
    // Valores, cobrança formal e histórico de ações são só do chave mestre
    // (RN20, RN33).
    ...(chaveMestre ? soChaveMestre : []),
  ];
}

function LinkDoMenu({ item }: { item: ItemMenu }) {
  return (
    <Nav.Link
      as={NavLink}
      to={item.para}
      end
      eventKey={item.para}
      onClick={item.aoClicar}
    >
      {item.icone && <Icone nome={item.icone} />}
      {item.texto}
    </Nav.Link>
  );
}

/**
 * Painel da sede, no ambiente clássico: menu lateral agrupado por assunto e
 * cada página numa folha branca. Itens do menu entram com cada funcionalidade.
 */
export function LayoutAdmin() {
  const principal = useFocoAoNavegar();

  // Na raiz do documento, para valer também nas janelas (modais), que o
  // Bootstrap abre fora do layout.
  useLayoutEffect(() => {
    document.documentElement.dataset.ambiente = 'sede';
    return () => {
      delete document.documentElement.dataset.ambiente;
    };
  }, []);

  return (
    <div className="elo-sede">
      <LinkPularConteudo />
      <aside className="elo-lateral">
        <Navbar
          expand="lg"
          variant="dark"
          collapseOnSelect
          className="flex-lg-column align-items-lg-stretch p-0"
        >
          <Navbar.Brand as={Link} to="/admin" className="elo-marca">
            <DesenhoMarca />
            <span>
              <span className="elo-marca-elo">Elo</span> Connect
              <span className="elo-marca-sub">Sede do sindicato</span>
            </span>
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="menu-principal">
            <Icone nome="menu" />
            Menu
          </Navbar.Toggle>
          <Navbar.Collapse id="menu-principal" className="flex-lg-column">
            <Nav
              as="nav"
              aria-label="Menu principal"
              className="flex-column w-100"
            >
              {gruposDoMenu(ehChaveMestre()).map((grupo) => (
                <Fragment key={grupo.titulo}>
                  <p className="elo-grupo-menu">{grupo.titulo}</p>
                  {grupo.itens.map((item) => (
                    <LinkDoMenu key={item.para} item={item} />
                  ))}
                </Fragment>
              ))}
              <hr className="my-2" />
              <LinkDoMenu
                item={{
                  para: '/',
                  texto: 'Sair',
                  icone: 'sair',
                  aoClicar: limparSessao,
                }}
              />
            </Nav>
          </Navbar.Collapse>
        </Navbar>
      </aside>
      <main
        id="conteudo"
        ref={principal}
        tabIndex={-1}
        className="elo-sede-conteudo"
      >
        <div className="elo-folha">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
