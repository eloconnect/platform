import { LayoutBase } from './LayoutBase';

/** Área pública: landing page, login e recuperação de senha. */
export function LayoutPublico() {
  return (
    <LayoutBase
      inicio="/"
      itensMenu={[
        { para: '/', texto: 'Início' },
        { para: '/cadastro', texto: 'Criar conta' },
        { para: '/entrar', texto: 'Entrar', destaque: true },
      ]}
    />
  );
}
