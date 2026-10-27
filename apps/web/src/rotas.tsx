import type { RouteObject } from 'react-router';
import { LayoutAdmin } from './layouts/LayoutAdmin';
import { LayoutAssociado } from './layouts/LayoutAssociado';
import { LayoutPublico } from './layouts/LayoutPublico';
import { RotaProtegida } from './layouts/RotaProtegida';
import { PaginaAssociados } from './paginas/admin/PaginaAssociados';
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
      { path: 'status', element: <PaginaStatus /> },
      { path: '*', element: <PaginaNaoEncontrada /> },
      { path: 'cadastro', element: <PaginaCadastro /> },
    ],
  },
  {
    path: '/associado',
    element: (
      <RotaProtegida perfil="ASSOCIADO">
        <LayoutAssociado />
      </RotaProtegida>
    ),
    children: [{ index: true, element: <PaginaInicioAssociado /> }],
  },
  {
    path: '/admin',
    element: (
      <RotaProtegida perfil="ADMIN">
        <LayoutAdmin />
      </RotaProtegida>
    ),
    children: [
      { index: true, element: <PaginaInicioAdmin /> },
      { path: 'associados', element: <PaginaAssociados /> },
      { path: 'associados/:id', element: <PaginaPerfilAssociado /> },
    ],
  },
];
