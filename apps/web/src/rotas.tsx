import { Navigate, type RouteObject } from 'react-router';
import { LayoutAdmin } from './layouts/LayoutAdmin';
import { LayoutAutenticacao } from './layouts/LayoutAutenticacao';
import { LayoutAssociado } from './layouts/LayoutAssociado';
import { LayoutPublico } from './layouts/LayoutPublico';
import { PaginaInicioAdmin } from './paginas/admin/PaginaInicioAdmin';
import { PaginaConvencoes } from './paginas/admin/PaginaConvencoes';
import { PaginaFichaAfiliado } from './paginas/admin/PaginaFichaAfiliado';
import { PaginaJucemat } from './paginas/admin/PaginaJucemat';
import { PaginaValores } from './paginas/admin/PaginaValores';
import { PaginaBeneficios } from './paginas/associado/PaginaBeneficios';
import { PaginaBoletos } from './paginas/associado/PaginaBoletos';
import { PaginaConvencoesAssociado } from './paginas/associado/PaginaConvencoesAssociado';
import { PaginaFiliacao } from './paginas/associado/PaginaFiliacao';
import { PaginaHistorico } from './paginas/associado/PaginaHistorico';
import { PaginaNoticias } from './paginas/associado/PaginaNoticias';
import { PaginaCadastroFarmacia } from './paginas/publico/PaginaCadastroFarmacia';
import { PaginaConfirmarCadastro } from './paginas/publico/PaginaConfirmarCadastro';
import { PaginaEntrar } from './paginas/publico/PaginaEntrar';
import { PaginaEsqueciSenha } from './paginas/publico/PaginaEsqueciSenha';
import { PaginaInicial } from './paginas/publico/PaginaInicial';
import { PaginaNaoEncontrada } from './paginas/publico/PaginaNaoEncontrada';
import { PaginaRedefinirSenha } from './paginas/publico/PaginaRedefinirSenha';
import { PaginaStatus } from './paginas/publico/PaginaStatus';

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
      { path: 'status', element: <PaginaStatus /> },
      { path: '*', element: <PaginaNaoEncontrada /> },
    ],
  },
  {
    path: '/entrar',
    element: <LayoutAutenticacao />,
    children: [{ index: true, element: <PaginaEntrar /> }],
  },
  {
    path: '/esqueci-senha',
    element: <LayoutAutenticacao />,
    children: [{ index: true, element: <PaginaEsqueciSenha /> }],
  },
  {
    path: '/redefinir-senha',
    element: <LayoutAutenticacao />,
    children: [{ index: true, element: <PaginaRedefinirSenha /> }],
  },
  {
    path: '/cadastro',
    element: <LayoutAutenticacao />,
    children: [
      { index: true, element: <PaginaCadastroFarmacia /> },
      { path: 'confirmar', element: <PaginaConfirmarCadastro /> },
    ],
  },
  {
    path: '/associado',
    element: <LayoutAssociado />,
    children: [
      { index: true, element: <PaginaBoletos /> },
      { path: 'historico', element: <PaginaHistorico /> },
      { path: 'beneficios', element: <PaginaBeneficios /> },
      { path: 'convencoes', element: <PaginaConvencoesAssociado /> },
      { path: 'filiacao', element: <PaginaFiliacao /> },
      { path: 'noticias', element: <PaginaNoticias /> },
    ],
  },
  {
    path: '/admin',
    element: <LayoutAdmin />,
    children: [
      { index: true, element: <PaginaInicioAdmin /> },
      { path: 'valores', element: <PaginaValores /> },
      { path: 'afiliados', element: <Navigate to="/admin" replace /> },
      { path: 'afiliados/:id', element: <PaginaFichaAfiliado /> },
      { path: 'convencoes', element: <PaginaConvencoes /> },
      { path: 'jucemat', element: <PaginaJucemat /> },
    ],
  },
];
