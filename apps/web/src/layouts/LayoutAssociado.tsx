import { LayoutBase } from './LayoutBase';

/** Área do associado logado. Itens do menu entram junto com cada funcionalidade. */
export function LayoutAssociado() {
  // TODO(#16, #21): exigir login de associado para acessar esta área.
  return (
    <LayoutBase
      inicio="/associado"
      itensMenu={[
        { para: '/associado', texto: 'Início' },
        { para: '/', texto: 'Sair' },
      ]}
    />
  );
}
