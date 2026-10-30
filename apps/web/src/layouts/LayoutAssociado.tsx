import { limparSessao } from '../sessao';
import { LayoutBase } from './LayoutBase';

/** Área do associado logado. */
export function LayoutAssociado() {
  return (
    <LayoutBase
      inicio="/associado"
      itensMenu={[
        { para: '/associado', texto: 'Início' },
        { para: '/associado/convencoes', texto: 'Convenções' },
        { para: '/associado/noticias', texto: 'Notícias' },
        { para: '/', texto: 'Sair', aoClicar: limparSessao },
      ]}
    />
  );
}
