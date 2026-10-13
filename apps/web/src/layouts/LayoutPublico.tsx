import { LayoutBase } from './LayoutBase';

/** Vitrine pública e páginas informativas abertas. */
export function LayoutPublico() {
  return (
    <LayoutBase
      inicio="/"
      expand="xl"
      itensMenu={[
        { para: '/', texto: 'Início' },
        { para: '#beneficios', texto: 'Benefícios', ancora: true },
        { para: '#convencoes', texto: 'Convenções coletivas', ancora: true },
        { para: '#suporte', texto: 'Suporte', ancora: true },
        { para: '/entrar', texto: 'Entrar' },
      ]}
      acaoPrimaria={{ para: '/cadastro', texto: 'Cadastrar farmácia' }}
    />
  );
}
