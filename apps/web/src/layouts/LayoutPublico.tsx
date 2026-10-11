import { LayoutBase } from './LayoutBase';

/** Área pública: landing page, login e recuperação de senha. */
export function LayoutPublico() {
  return (
    <LayoutBase
      inicio="/"
      itensMenu={[
        { para: '/', texto: 'Início' },
        { para: '/entrar', texto: 'Entrar' },
      ]}
    />
  );
}
