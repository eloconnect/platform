import { NavLink, Outlet } from 'react-router';
import '../estilos/admin.scss';
import {
  IconeConvencoes,
  IconeJucemat,
  IconePainel,
  IconeValores,
  IconeDocumento,
} from '../paginas/admin/icones';
import { limparSessao } from '../sessao';

const ITENS = [
  {
    para: '/admin',
    texto: 'Associados',
    icone: <IconePainel />,
    fim: true,
  },
  {
    para: '/admin/valores',
    texto: 'Valores & Reajustes',
    icone: <IconeValores />,
  },
  {
    para: '/admin/convencoes',
    texto: 'Convenções coletivas',
    icone: <IconeConvencoes />,
  },
  {
    para: '/admin/suporte',
    texto: 'Solicitações de suporte',
    icone: <IconeDocumento />,
  },
  {
    para: '/admin/jucemat',
    texto: 'Cancelamentos e cobrança',
    icone: <IconeJucemat />,
  },
];

/** Painel da sede, com menu lateral. */
export function LayoutAdmin() {
  // TODO(#16): exigir login de administrador para acessar esta área.
  return (
    <div className="adm-app">
      <a className="visually-hidden-focusable link-pular" href="#conteudo">
        Pular para o conteúdo
      </a>
      <aside className="adm-lateral">
        <div className="adm-marca">
          <span className="adm-marca-logo" aria-hidden="true">
            E
          </span>
          <div>
            <strong>Elo Connect</strong>
            <small>Painel da sede</small>
          </div>
        </div>

        <div className="adm-sede">
          <small>ADMINISTRAÇÃO</small>
          <strong>Associados e conteúdo</strong>
        </div>

        <nav aria-label="Menu do painel">
          <ul>
            {ITENS.map((item) => (
              <li key={item.para}>
                <NavLink to={item.para} end={item.fim}>
                  {item.icone}
                  <span>{item.texto}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <NavLink to="/" className="adm-sair" onClick={limparSessao}>
          Sair
        </NavLink>
      </aside>

      <main id="conteudo" tabIndex={-1} className="adm-principal">
        <Outlet />
      </main>
    </div>
  );
}
