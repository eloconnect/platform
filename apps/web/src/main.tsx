import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import './estilos/tema.scss';
import { rotas } from './rotas';

const roteador = createBrowserRouter(rotas);

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <RouterProvider router={roteador} />
  </StrictMode>,
);
