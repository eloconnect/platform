import { limparSessao } from '../sessao';
import { LayoutBase } from './LayoutBase';

/** Painel da sede. Itens do menu entram junto com cada funcionalidade. */
export function LayoutAdmin() {
  return (
    <LayoutBase
      inicio="/admin"
      itensMenu={[
        { para: '/admin', texto: 'Painel' },
        { para: '/admin/associados', texto: 'Associados' },
        { para: '/', texto: 'Sair', aoClicar: limparSessao },
      ]}
    />
  );
}
