import { limparSessao } from '../sessao';
import { LayoutBase } from './LayoutBase';

/** Área do associado logado. Itens do menu entram junto com cada funcionalidade. */
export function LayoutAssociado() {
  return (
    <LayoutBase
      inicio="/associado"
      itensMenu={[
        { para: '/associado', texto: 'Início' },
        { para: '/associado/noticias', texto: 'Notícias' },
        { para: '/associado/convencoes', texto: 'Convenções' },
        { para: '/associado/boletos', texto: 'Boletos' },
        { para: '/', texto: 'Sair', aoClicar: limparSessao },
      ]}
    />
  );
}
