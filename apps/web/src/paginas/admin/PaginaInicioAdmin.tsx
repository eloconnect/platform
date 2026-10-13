import { useState } from 'react';
import { Link } from 'react-router';
import { useTituloPagina } from '../../componentes';
import { api } from '../../api';
import { AvisoCarga, CabecalhoAdmin, TopoAdmin } from './ComponentesAdmin';
import { cnpjMascarado, useDadosAdmin } from './useDadosAdmin';
import { IconeLupa, IconeOlho, IconePredio, IconeProibido } from './icones';

export const ROTULO_SITUACAO = {
  EM_DIA: 'Adimplente',
  PENDENTE: 'Inadimplente',
  INADIMPLENTE: 'Inadimplente',
} as const;

/** Lista de associados para consulta pela sede. */
export function PaginaInicioAdmin() {
  useTituloPagina('Associados');
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(1);
  const lista = useDadosAdmin(
    (token) => api.admin.associados(token, busca.trim(), pagina),
    [busca, pagina],
  );

  const l = lista.dados;
  const primeiro = l && l.itens.length ? (l.pagina - 1) * l.porPagina + 1 : 0;
  const ultimo = l && l.itens.length ? primeiro + l.itens.length - 1 : 0;
  const paginas = l ? janelaPaginas(l.pagina, l.totalPaginas) : [];

  return (
    <>
      <TopoAdmin />
      <CabecalhoAdmin
        titulo="Associados"
        descricao="Busque associados e consulte os dados cadastrais e a situação da contribuição."
      />

      <section className="adm-cartao adm-lista" aria-label="Associados">
        <label className="adm-busca">
          <IconeLupa />
          <input
            type="search"
            aria-label="Buscar por razão social, nome fantasia ou CNPJ"
            placeholder="Buscar associado por nome ou CNPJ"
            value={busca}
            onChange={(event) => {
              setBusca(event.target.value);
              setPagina(1);
            }}
          />
        </label>
        <AvisoCarga carregando={lista.carregando} erro={lista.erro} />

        <div className="adm-tabela-rolagem">
          <table className="adm-tabela">
            <thead>
              <tr>
                <th scope="col">Farmácia / CNPJ</th>
                <th scope="col">Município</th>
                <th scope="col">Situação</th>
                <th scope="col" className="adm-coluna-acao">
                  Ação
                </th>
              </tr>
            </thead>
            <tbody>
              {l?.itens.map((farmacia) => {
                const inadimplente = farmacia.situacao !== 'EM_DIA';
                return (
                  <tr key={farmacia.id}>
                    {/* oxlint-disable-next-line jsx-a11y/control-has-associated-label -- célula identificada pelo nome da farmácia */}
                    <td>
                      <div className="adm-farmacia">
                        <span
                          aria-hidden="true"
                          className={`adm-icone-linha ${
                            inadimplente ? 'adm-icone-linha-erro' : ''
                          }`}
                        >
                          {inadimplente ? <IconeProibido /> : <IconePredio />}
                        </span>
                        <div>
                          <strong>{farmacia.nome}</strong>
                          <small>{cnpjMascarado(farmacia.cnpj)}</small>
                        </div>
                      </div>
                    </td>
                    <td>{farmacia.cidade}</td>
                    <td>
                      <span
                        className={`adm-situacao adm-situacao-${farmacia.situacao.toLowerCase()}`}
                      >
                        <span aria-hidden="true" className="adm-ponto" />
                        {ROTULO_SITUACAO[farmacia.situacao]}
                      </span>
                    </td>
                    <td className="adm-coluna-acao">
                      <Link
                        to={`/admin/associados/${farmacia.id}`}
                        className="adm-ver-perfil"
                        aria-label={`Ver perfil de ${farmacia.nome}`}
                      >
                        <IconeOlho />
                        <span>Ver perfil</span>
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {l && l.itens.length === 0 && (
                <tr>
                  <td colSpan={4} className="adm-sem-resultado">
                    Nenhum associado encontrado para essa busca.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <footer className="adm-rodape-lista">
          <p>
            Mostrando <strong>{primeiro}</strong> a <strong>{ultimo}</strong> de{' '}
            <strong>{l?.total ?? 0}</strong> associados
          </p>
          <nav className="adm-paginacao" aria-label="Paginação">
            <button
              type="button"
              disabled={!l || l.pagina <= 1}
              onClick={() => setPagina((p) => p - 1)}
            >
              Anterior
            </button>
            {paginas.map((p, i) =>
              p === null ? (
                <span key={`gap-${i}`} aria-hidden="true">
                  ...
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  aria-current={p === l?.pagina ? 'page' : undefined}
                  className={p === l?.pagina ? 'adm-pagina-atual' : undefined}
                  onClick={() => setPagina(p)}
                >
                  {p}
                </button>
              ),
            )}
            <button
              type="button"
              disabled={!l || l.pagina >= l.totalPaginas}
              onClick={() => setPagina((p) => p + 1)}
            >
              Próxima
            </button>
          </nav>
        </footer>
      </section>
    </>
  );
}

/** Primeiras páginas, reticências (null) e a última. */
function janelaPaginas(atual: number, total: number): (number | null)[] {
  if (total <= 6) return Array.from({ length: total }, (_, i) => i + 1);
  const inicio = Math.min(Math.max(1, atual - 1), total - 3);
  const meio = Array.from({ length: 3 }, (_, i) => inicio + i);
  return [...meio, ...(inicio + 3 < total ? [null] : []), total];
}
