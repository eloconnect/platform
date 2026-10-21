import { Link } from 'react-router';

// Logo em apps/web/public/images (servida a partir da raiz: /images/...).
export const LOGO_ELO = '/images/logo.png';

/**
 * Logo + nome do Elo Connect.
 * Por padrão aparece centralizada (telas de login, cadastro e recuperação de
 * senha). No cabeçalho, o LayoutBase usa centralizada={false}.
 */
export function MarcaElo({
  para = '/',
  centralizada = true,
}: {
  para?: string;
  centralizada?: boolean;
}) {
  return (
    <Link
      to={para}
      className={`marca-elo${centralizada ? ' marca-elo-centralizada' : ''}`}
      aria-label="Elo Connect — início"
    >
      <span className="logo-elo-connect" aria-hidden="true">
        <img src={LOGO_ELO} alt="" />
      </span>
      <span className="marca-elo-nome">Elo Connect</span>
      {centralizada && (
        <span className="marca-elo-descricao">Gestão sindical</span>
      )}
    </Link>
  );
}
