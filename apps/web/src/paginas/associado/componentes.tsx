import type { ReactNode } from 'react';

const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

/** "2025-11-01" vira "Novembro/2025" (datas sem fuso, em UTC). */
export function mesAno(iso: string): string {
  const d = new Date(iso);
  return `${MESES[d.getUTCMonth()]}/${d.getUTCFullYear()}`;
}

export function Cabecalho({
  selo,
  titulo,
  descricao,
  lateral,
}: {
  selo?: string;
  titulo: string;
  descricao?: string;
  lateral?: ReactNode;
}) {
  return (
    <header className="as-titulo">
      <div>
        {selo && <p className="as-selo">{selo}</p>}
        <h1>{titulo}</h1>
        {descricao && <p className="as-descricao">{descricao}</p>}
      </div>
      {lateral}
    </header>
  );
}
