import { ehChaveMestre, limparSessao } from '../sessao';
import { LayoutBase } from './LayoutBase';

/** Painel da sede. Itens do menu entram junto com cada funcionalidade. */
export function LayoutAdmin() {
  return (
    <LayoutBase
      inicio="/admin"
      itensMenu={[
        { para: '/admin', texto: 'Painel' },
        { para: '/admin/associados', texto: 'Associados' },
        // O histórico de ações é só do chave mestre (RN33).
        ...(ehChaveMestre()
          ? [{ para: '/admin/auditoria', texto: 'Histórico de ações' }]
          : []),
        { para: '/', texto: 'Sair', aoClicar: limparSessao },
      ]}
    />
  );
}
