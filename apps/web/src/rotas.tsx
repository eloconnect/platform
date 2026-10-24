import type { RouteObject } from 'react-router';
import { LayoutAdmin } from './layouts/LayoutAdmin';
import { LayoutAssociado } from './layouts/LayoutAssociado';
import { LayoutPublico } from './layouts/LayoutPublico';
import { PaginaInicioAdmin } from './paginas/admin/PaginaInicioAdmin';
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
    element: <LayoutAssociado />,
    children: [{ index: true, element: <PaginaInicioAssociado /> }],
  },
  {
    path: '/admin',
    element: <LayoutAdmin />,
    children: [{ index: true, element: <PaginaInicioAdmin /> }],
  },
];
