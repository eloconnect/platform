import { useState } from 'react';
import { Link } from 'react-router';
import { useTituloPagina } from '../../componentes';
import { api } from '../../api';
import { AvisoCarga, CabecalhoAdmin, TopoAdmin } from './ComponentesAdmin';
import { cnpjMascarado, moeda, useDadosAdmin } from './useDadosAdmin';
import {
  IconeBanco,
  IconeCalendario,
  IconeCarteira,
  IconeEscudo,
  IconeLupa,
  IconeMais,
  IconeOlho,
  IconePredio,
  IconeProibido,
} from './icones';

export const ROTULO_SITUACAO = {
  EM_DIA: 'Em Dia',
  PENDENTE: 'Pendente',
  INADIMPLENTE: 'Inadimplente',
} as const;

/** Painel executivo da sede: indicadores, emissão em lote e lista de farmácias. */
export function PaginaInicioAdmin() {
  useTituloPagina('Painel Executivo');
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(1);

  const resumo = useDadosAdmin((token) => api.admin.resumo(token), []);
  const lista = useDadosAdmin(
    (token) => api.admin.associados(token, busca.trim(), pagina),
    [busca, pagina],
  );

  const r = resumo.dados;
  const l = lista.dados;
  const primeiro = l && l.itens.length ? (l.pagina - 1) * l.porPagina + 1 : 0;
  const ultimo = l && l.itens.length ? primeiro + l.itens.length - 1 : 0;
  const paginas = l ? janelaPaginas(l.pagina, l.totalPaginas) : [];

  return (
    <>
      <TopoAdmin plantao />
      <CabecalhoAdmin
        selo="SEDE CENTRAL"
        titulo="Painel Executivo de Arrecadação Patronal"
        descricao="Gestão do quadro social de drogarias afiliadas, conciliação Sicredi e emissões em lote."
        acao={
          <button type="button" className="adm-botao-primario">
            <IconeMais />
            <span>Novo Afiliado</span>
          </button>
        }
      />
      <AvisoCarga carregando={false} erro={resumo.erro} />

      <section className="adm-indicadores" aria-label="Indicadores">
        <article className="adm-cartao adm-indicador">
          <div className="adm-indicador-topo">
            <h2>Farmácias Cadastradas</h2>
            <span className="adm-indicador-icone">
              <IconeCalendario />
            </span>
          </div>
          <p className="adm-indicador-valor">{r?.totalAssociados ?? '—'}</p>
          <p className="adm-indicador-nota">Quadro geral ativo</p>
        </article>

        <article className="adm-cartao adm-indicador">
          <div className="adm-indicador-topo">
            <h2>Taxa de Adimplência</h2>
            <span className="adm-indicador-icone">
              <IconeEscudo />
            </span>
          </div>
          <p className="adm-indicador-valor">
            {r ? `${r.taxaAdimplencia.toString().replace('.', ',')}%` : '—'}
            {r && <small>({r.emDia} em dia)</small>}
          </p>
          <div
            className="adm-progresso"
            role="progressbar"
            aria-label="Taxa de adimplência"
            aria-valuenow={r?.taxaAdimplencia ?? 0}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span style={{ width: `${r?.taxaAdimplencia ?? 0}%` }} />
          </div>
        </article>

        <article className="adm-cartao adm-indicador">
          <div className="adm-indicador-topo">
            <h2>Arrecadação Mensal</h2>
            <span className="adm-indicador-icone adm-indicador-icone-forte">
              <IconeCarteira />
            </span>
          </div>
          <p className="adm-indicador-valor adm-indicador-destaque">
            {r ? moeda(r.arrecadacaoMensal) : '—'}
          </p>
          <p className="adm-indicador-nota">Previsão da competência atual</p>
        </article>
      </section>

      <section className="adm-cartao adm-lote" aria-labelledby="titulo-lote">
        <p className="adm-lote-etiquetas">
          <span className="adm-etiqueta adm-etiqueta-azul">
            <IconeBanco />
            Disparo de Cobrança Mensal Sicredi
          </span>
          <span className="adm-etiqueta adm-etiqueta-suave">
            Pronto para Envio
          </span>
        </p>
        <h2 id="titulo-lote">Emissão em Lote – Convênio Sicredi Patronal</h2>
      </section>

      <section className="adm-cartao adm-lista" aria-label="Farmácias">
        <label className="adm-busca">
          <IconeLupa />
          <input
            type="search"
            aria-label="Buscar por razão social, nome fantasia ou CNPJ"
            placeholder="Buscar por Razão Social, Nome Fantasia ou CNPJ..."
            value={busca}
            onChange={(event) => {
              setBusca(event.target.value);
              setPagina(1);
            }}
          />
        </label>
        <AvisoCarga carregando={false} erro={lista.erro} />

        <div className="adm-tabela-rolagem">
          <table className="adm-tabela">
            <thead>
              <tr>
                <th scope="col">Farmácia / CNPJ</th>
                <th scope="col">Cidade / UF</th>
                <th scope="col">Situação Sindical</th>
                <th scope="col" className="adm-coluna-acao">
                  Ação
                </th>
              </tr>
            </thead>
            <tbody>
              {l?.itens.map((farmacia) => {
                const inadimplente = farmacia.situacao === 'INADIMPLENTE';
                return (
                  <tr key={farmacia.id}>
                    {/* oxlint-disable-next-line jsx-a11y/control-has-associated-label -- a célula tem o nome da farmácia */}
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
                        to={`/admin/afiliados/${farmacia.id}`}
                        className={`adm-ver-perfil ${
                          inadimplente ? 'adm-ver-perfil-erro' : ''
                        }`}
                        aria-label={`Ver perfil de ${farmacia.nome}`}
                      >
                        <IconeOlho />
                        <span>Ver Perfil</span>
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {l && l.itens.length === 0 && (
                <tr>
                  <td colSpan={4} className="adm-sem-resultado">
                    Nenhuma farmácia encontrada para essa busca.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <footer className="adm-rodape-lista">
          <p>
            Mostrando <strong>{primeiro}</strong> a <strong>{ultimo}</strong> de{' '}
            <strong>{l?.total ?? 0}</strong> farmácias cadastradas
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
