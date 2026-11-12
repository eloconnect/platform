import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
// Fontes servidas pelo próprio site, sem pedido a terceiros.
import '@fontsource-variable/atkinson-hyperlegible-next/index.css';
import '@fontsource-variable/figtree/index.css';
import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans/latin-700.css';
import './estilos/tema.scss';
import { rotas } from './rotas';

const roteador = createBrowserRouter(rotas);

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <RouterProvider router={roteador} />
  </StrictMode>,
);
