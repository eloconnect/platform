import { useEffect } from 'react';

/** Título da aba do navegador, lido primeiro pelos leitores de tela. */
export function useTituloPagina(titulo: string) {
  useEffect(() => {
    document.title = `${titulo} | Elo Connect`;
  }, [titulo]);
}
