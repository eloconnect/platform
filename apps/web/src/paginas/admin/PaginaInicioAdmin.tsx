import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { useTituloPagina } from '../../componentes';
import { api } from '../../api';
import { AvisoCarga, CabecalhoAdmin, TopoAdmin } from './ComponentesAdmin';
import {
  cnpjMascarado,
  executarAdmin,
  salvarArquivo,
  useDadosAdmin,
} from './useDadosAdmin';
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
  const [atualizacao, setAtualizacao] = useState(0);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [importando, setImportando] = useState(false);
  const [baixandoPdf, setBaixandoPdf] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const campoArquivo = useRef<HTMLInputElement>(null);
  const [periodoRelatorio, setPeriodoRelatorio] = useState<'mes' | 'ano'>(
    'mes',
  );
  const [mesRelatorio, setMesRelatorio] = useState(() => {
    const hoje = new Date();
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
  });
  const [anoRelatorio, setAnoRelatorio] = useState(() =>
    String(new Date().getFullYear()),
  );
  const [somenteInadimplentes, setSomenteInadimplentes] = useState(false);
  const [baixandoRelatorio, setBaixandoRelatorio] = useState(false);
  const [mensagemRelatorio, setMensagemRelatorio] = useState<string | null>(
    null,
  );
  const lista = useDadosAdmin(
    (token) => api.admin.associados(token, busca.trim(), pagina),
    [busca, pagina, atualizacao],
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

      <section
        className="adm-cartao adm-importacao"
        aria-labelledby="t-importar-associados"
      >
        <div>
          <h2 id="t-importar-associados">Base estadual de farmácias</h2>
          <p>
            Importe um CSV para criar farmácias novas e atualizar cadastros
            existentes pelo CNPJ. Campos vazios preservam os dados já
            cadastrados.
          </p>
          <small>
            Colunas obrigatórias: CNPJ e Razão Social. Opcionais: Nome Fantasia,
            Município, E-mail e Telefone.
          </small>
        </div>
        <form
          className="adm-importacao-formulario"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!arquivo) return;
            if (!arquivo.name.toLowerCase().endsWith('.csv')) {
              setMensagem('Selecione um arquivo com extensão .csv.');
              return;
            }
            setImportando(true);
            const resultado = await executarAdmin((token) =>
              api.admin.importarAssociadosCsv(token, arquivo),
            );
            setImportando(false);
            if (resultado.erro) {
              setMensagem(resultado.erro);
              return;
            }
            if (resultado.dados) {
              setMensagem(
                `Importação concluída: ${resultado.dados.criados} novos e ${resultado.dados.atualizados} atualizados.`,
              );
              setArquivo(null);
              if (campoArquivo.current) campoArquivo.current.value = '';
              setPagina(1);
              setAtualizacao((versao) => versao + 1);
            }
          }}
        >
          <label htmlFor="csv-associados">Arquivo CSV</label>
          <input
            ref={campoArquivo}
            id="csv-associados"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              setArquivo(event.target.files?.[0] ?? null);
              setMensagem(null);
            }}
          />
          <div className="adm-importacao-acoes">
            <button
              type="button"
              className="adm-botao-secundario"
              disabled={baixandoPdf}
              onClick={async () => {
                setBaixandoPdf(true);
                const resultado = await executarAdmin((token) =>
                  api.admin.exportarListaAssociadosPdf(token),
                );
                setBaixandoPdf(false);
                if (resultado.erro) {
                  setMensagem(resultado.erro);
                } else if (resultado.dados) {
                  salvarArquivo(resultado.dados, 'farmacias-associadas.pdf');
                  setMensagem('A lista de farmácias foi baixada em PDF.');
                }
              }}
            >
              {baixandoPdf ? 'Gerando PDF…' : 'Baixar lista em PDF'}
            </button>
            <button
              type="submit"
              className="adm-botao-primario"
              disabled={!arquivo || importando}
            >
              {importando ? 'Importando…' : 'Importar CSV'}
            </button>
          </div>
        </form>
        {mensagem && (
          <output className="adm-importacao-mensagem">{mensagem}</output>
        )}
      </section>

      <section
        className="adm-cartao adm-relatorio"
        aria-labelledby="t-relatorio-recebimentos"
      >
        <div className="adm-relatorio-intro">
          <h2 id="t-relatorio-recebimentos">
            Relatório de pagamentos recebidos
          </h2>
          <p>
            Consulte o total recebido e os pagamentos por farmácia, usando a
            data em que cada pagamento foi registrado.
          </p>
        </div>
        <div className="adm-relatorio-controles">
          <label>
            <span>Período</span>
            <select
              aria-label="Período do relatório"
              value={periodoRelatorio}
              onChange={(event) => {
                setPeriodoRelatorio(
                  event.target.value === 'ano' ? 'ano' : 'mes',
                );
                setMensagemRelatorio(null);
              }}
            >
              <option value="mes">Mês</option>
              <option value="ano">Ano</option>
            </select>
          </label>
          {periodoRelatorio === 'mes' ? (
            <label>
              <span>Mês de recebimento</span>
              <input
                aria-label="Mês de recebimento"
                type="month"
                value={mesRelatorio}
                onChange={(event) => {
                  setMesRelatorio(event.target.value);
                  setMensagemRelatorio(null);
                }}
              />
            </label>
          ) : (
            <label>
              <span>Ano de recebimento</span>
              <input
                aria-label="Ano de recebimento"
                type="number"
                min="2000"
                max="9999"
                value={anoRelatorio}
                onChange={(event) => {
                  setAnoRelatorio(event.target.value);
                  setMensagemRelatorio(null);
                }}
              />
            </label>
          )}
          <label>
            <span>Situação das farmácias</span>
            <select
              aria-label="Situação das farmácias no relatório"
              value={somenteInadimplentes ? 'inadimplentes' : 'todas'}
              onChange={(event) => {
                setSomenteInadimplentes(event.target.value === 'inadimplentes');
                setMensagemRelatorio(null);
              }}
            >
              <option value="todas">Todas com pagamento</option>
              <option value="inadimplentes">Somente inadimplentes</option>
            </select>
          </label>
          <button
            type="button"
            className="adm-botao-primario"
            disabled={
              baixandoRelatorio ||
              (periodoRelatorio === 'mes'
                ? !/^\d{4}-(0[1-9]|1[0-2])$/.test(mesRelatorio)
                : !/^\d{4}$/.test(anoRelatorio) || Number(anoRelatorio) < 2000)
            }
            onClick={async () => {
              const referencia =
                periodoRelatorio === 'mes' ? mesRelatorio : anoRelatorio;
              setBaixandoRelatorio(true);
              setMensagemRelatorio(null);
              const resultado = await executarAdmin((token) =>
                api.admin.exportarRecebimentosPdf(
                  token,
                  periodoRelatorio,
                  referencia,
                  somenteInadimplentes,
                ),
              );
              setBaixandoRelatorio(false);
              if (resultado.erro) {
                setMensagemRelatorio(resultado.erro);
              } else if (resultado.dados) {
                salvarArquivo(
                  resultado.dados,
                  `recebimentos-${referencia}${somenteInadimplentes ? '-inadimplentes' : ''}.pdf`,
                );
                setMensagemRelatorio('Relatório baixado em PDF.');
              }
            }}
          >
            {baixandoRelatorio ? 'Gerando PDF…' : 'Baixar relatório em PDF'}
          </button>
        </div>
        {mensagemRelatorio && (
          <output className="adm-relatorio-mensagem">
            {mensagemRelatorio}
          </output>
        )}
      </section>

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
