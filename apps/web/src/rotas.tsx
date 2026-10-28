import type { RouteObject } from 'react-router';
import { LayoutAdmin } from './layouts/LayoutAdmin';
import { LayoutAssociado } from './layouts/LayoutAssociado';
import { LayoutPublico } from './layouts/LayoutPublico';
import { RotaProtegida } from './layouts/RotaProtegida';
import { PaginaAssociados } from './paginas/admin/PaginaAssociados';
import { PaginaFormularioAssociado } from './paginas/admin/PaginaFormularioAssociado';
import { PaginaInicioAdmin } from './paginas/admin/PaginaInicioAdmin';
import { PaginaPerfilAssociado } from './paginas/admin/PaginaPerfilAssociado';
import { PaginaInicioAssociado } from './paginas/associado/PaginaInicioAssociado';
import { PaginaEntrar } from './paginas/publico/PaginaEntrar';
import { PaginaEsqueciSenha } from './paginas/publico/PaginaEsqueciSenha';
import { PaginaInicial } from './paginas/publico/PaginaInicial';
import { PaginaNaoEncontrada } from './paginas/publico/PaginaNaoEncontrada';
import { PaginaRedefinirSenha } from './paginas/publico/PaginaRedefinirSenha';
import { PaginaStatus } from './paginas/publico/PaginaStatus';
import { PaginaCadastro } from './paginas/publico/PaginaCadastro';

/**
 * Rotas do app, em três áreas: pública, do associado e da sede.
 * Endereços em português, porque aparecem para o usuário.
 */
export const rotas: RouteObject[] = [
  {
    path: '/',
    element: <LayoutPublico />,
    children: [
      { index: true, element: <PaginaInicial /> },
      { path: 'entrar', element: <PaginaEntrar /> },
      { path: 'esqueci-senha', element: <PaginaEsqueciSenha /> },
      { path: 'redefinir-senha', element: <PaginaRedefinirSenha /> },
      {
        path: 'criar-senha',
        element: <PaginaRedefinirSenha variante="criar" />,
      },
      { path: 'status', element: <PaginaStatus /> },
      { path: '*', element: <PaginaNaoEncontrada /> },
      { path: 'cadastro', element: <PaginaCadastro /> },
    ],
  },
  {
    path: '/associado',
    element: (
      <RotaProtegida perfis={['ASSOCIADO']}>
        <LayoutAssociado />
      </RotaProtegida>
    ),
    children: [{ index: true, element: <PaginaInicioAssociado /> }],
  },
  {
    path: '/admin',
    element: (
      <RotaProtegida perfis={['ADMIN', 'ADMIN_BASICO']}>
        <LayoutAdmin />
      </RotaProtegida>
    ),
    children: [
      { index: true, element: <PaginaInicioAdmin /> },
      { path: 'associados', element: <PaginaAssociados /> },
      {
        path: 'associados/novo',
        element: (
          <RotaProtegida perfis={['ADMIN']}>
            <PaginaFormularioAssociado />
          </RotaProtegida>
        ),
      },
      { path: 'associados/:id', element: <PaginaPerfilAssociado /> },
      {
        path: 'associados/:id/editar',
        element: (
          <RotaProtegida perfis={['ADMIN']}>
            <PaginaFormularioAssociado />
          </RotaProtegida>
        ),
      },
    ],
  },
];
