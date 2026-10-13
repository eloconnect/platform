import { Link } from 'react-router';

export function MarcaElo() {
  return (
    <Link
      className="marca-autenticacao"
      to="/"
      aria-label="Elo Connect — início"
    >
      <span className="marca-autenticacao-icone" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <path
            d="M9.2 14.8 7.8 16.2a4 4 0 0 1-5.7-5.7l4-4a4 4 0 0 1 5.7 0m3 2.7 1.4-1.4a4 4 0 1 1 5.7 5.7l-4 4a4 4 0 0 1-5.7 0m-4.1-5.4h8.2"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
      </span>
      <span className="marca-autenticacao-nome">Elo Connect</span>
      <span className="marca-autenticacao-descricao">Gestão sindical</span>
    </Link>
  );
}
