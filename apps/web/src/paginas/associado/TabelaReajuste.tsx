import type { LinhaReajuste } from '@eloconnect/shared';
import { formatarReais, textoReajuste } from '@eloconnect/shared';

/**
 * Tabela de reajuste salarial da convenção (US21: RF21, P24). No celular, cada
 * função vira um bloco, sem rolar para o lado (RNF03).
 */
export function TabelaReajuste({
  linhas,
  nivelTitulo = 'h3',
}: {
  linhas: LinhaReajuste[];
  nivelTitulo?: 'h3' | 'h4';
}) {
  const Titulo = nivelTitulo;
  return (
    <section className="mb-3" aria-label="Tabela de reajuste">
      <Titulo className="h5">Tabela de reajuste</Titulo>
      <ul className="list-unstyled mb-0">
        {linhas.map((linha) => (
          <li key={linha.funcao} className="border-top py-2">
            <strong className="d-block">{linha.funcao}</strong>
            <span className="d-block">
              Piso anterior: {formatarReais(linha.pisoAnterior)}
            </span>
            <span className="d-block">
              Piso novo: <strong>{formatarReais(linha.pisoNovo)}</strong>
              {textoReajuste(linha) && ` (reajuste de ${textoReajuste(linha)})`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
