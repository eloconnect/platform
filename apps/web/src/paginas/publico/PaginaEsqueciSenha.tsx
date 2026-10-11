import { useTituloPagina } from '../../componentes';

/** Recuperação de senha por link no e-mail (US04, issue #19). */
export function PaginaEsqueciSenha() {
  useTituloPagina('Esqueci minha senha');
  // TODO(#19): pedir o e-mail e, depois, a tela de nova senha.
  return (
    <>
      <h1>Esqueci minha senha</h1>
      <p>Tela de recuperação de senha. Em construção (issue #19).</p>
    </>
  );
}
