import { LayoutBase } from './LayoutBase';

/** Vitrine pública e páginas informativas abertas. */
export function LayoutPublico() {
  return (
    <LayoutBase
      inicio="/"
      expand="xl"
      itensMenu={[
        { para: '/', texto: 'Início' },
        { para: '#convencoes', texto: 'Convenções coletivas', ancora: true },
        { para: '#atuacao', texto: 'Jurídico sindical', ancora: true },
        { para: '#atuacao', texto: 'Associados', ancora: true },
        { para: '/entrar', texto: 'Contribuições' },
        { para: '/entrar', texto: 'Entrar' },
      ]}
      acaoPrimaria={{ para: '/cadastro', texto: 'Cadastrar farmácia' }}
    />
  );
}
