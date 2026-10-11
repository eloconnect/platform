import { LayoutBase } from './LayoutBase';

/** Painel da sede. Itens do menu entram junto com cada funcionalidade. */
export function LayoutAdmin() {
  // TODO(#16): exigir login de administrador para acessar esta área.
  return (
    <LayoutBase
      inicio="/admin"
      itensMenu={[
        { para: '/admin', texto: 'Painel' },
        { para: '/', texto: 'Sair' },
      ]}
    />
  );
}
