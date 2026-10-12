import { Link } from 'react-router-dom';

type BrandProps = {
  compact?: boolean;
  light?: boolean;
};

function Brand({ compact = false, light = false }: BrandProps) {
  return (
    <Link
      className={`brand${light ? ' brand--light' : ''}`}
      to="/"
      aria-label="Elo Connect — página inicial"
    >
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 32 32" focusable="false">
          <path
            d="M13 10H10a6 6 0 0 0 0 12h4m4-12h4a6 6 0 0 1 0 12h-4m-8-6h12"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.5"
          />
        </svg>
      </span>
      <span className="brand-copy">
        <span className="brand-name">Elo Connect</span>
        {!compact && <span className="brand-caption">Gestão sindical</span>}
      </span>
    </Link>
  );
}

export default Brand;
