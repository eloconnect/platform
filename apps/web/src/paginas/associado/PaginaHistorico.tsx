import { Link } from 'react-router';
import { api } from '../../api';
import { useTituloPagina } from '../../componentes';
import { AvisoCarga } from '../admin/ComponentesAdmin';
import {
  cnpjMascarado,
  data,
  moeda,
  useDadosAdmin,
} from '../admin/useDadosAdmin';
import { Cabecalho, mesAno } from './componentes';

/** Mensalidades quitadas e situação cadastral. */
export function PaginaHistorico() {
  useTituloPagina('Histórico de Boletos');
  const {
    dados: h,
    erro,
    carregando,
  } = useDadosAdmin((token) => api.associado.historico(token), []);

  return (
    <>
      <nav className="as-migalhas" aria-label="Você está em">
        <Link to="/associado">‹ Boletos</Link>
        {h && (
          <span className="as-cnpj">
            CNPJ: {cnpjMascarado(h.cnpj)} • {h.nomeFantasia ?? h.razaoSocial}
          </span>
        )}
      </nav>
      <Cabecalho
        titulo="Histórico de Boletos e Pagamentos"
        descricao="Consulte todas as mensalidades quitadas e emita comprovantes com facilidade."
      />
      <AvisoCarga carregando={carregando} erro={erro} />

      {h && (
        <>
          <section
            className="as-cartao as-situacao"
            aria-label="Situação cadastral"
          >
            <div>
              <p className="as-etiqueta">STATUS GERAL DE CONTRIBUIÇÃO</p>
              <p className="as-situacao-titulo">
                Situação Cadastral:{' '}
                <em className={h.emDia ? 'as-ok' : 'as-alerta'}>
                  {h.emDia ? 'TOTALMENTE EM DIA' : 'COM PENDÊNCIA'}
                </em>
              </p>
              <p className="as-descricao">
                {h.emDia
                  ? 'Nenhuma pendência financeira ou documental em aberto.'
                  : 'Há mensalidade em aberto. Regularize para manter seus benefícios.'}
              </p>
            </div>
            <button
              type="button"
              className="as-botao"
              disabled
              title="A certidão será emitida com a integração bancária"
            >
              Emitir Certidão de Quitação (CND)
            </button>
          </section>

          <section className="as-cartao" aria-labelledby="t-quitadas">
            <div className="as-linha-titulo">
              <div>
                <h2 id="t-quitadas">Mensalidades Sindicais Quitadas</h2>
                <p className="as-descricao">
                  Comprovantes válidos para fins fiscais, contábeis e auditorias
                  sindicais.
                </p>
              </div>
              <button
                type="button"
                className="as-botao as-botao-claro as-botao-pequeno"
                onClick={() => window.print()}
              >
                Imprimir Relatório
              </button>
            </div>
            <div className="as-tabela-rolagem">
              <table className="as-tabela">
                <thead>
                  <tr>
                    <th scope="col">Mês de Referência</th>
                    <th scope="col">Data de Pagamento</th>
                    <th scope="col">Valor Quitado</th>
                    <th scope="col">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {h.itens.map((i) => (
                    <tr key={i.id}>
                      <th scope="row">{mesAno(i.competencia)}</th>
                      <td>{data(i.pagoEm)}</td>
                      <td>{moeda(i.valor)}</td>
                      <td>
                        <span className="as-etiqueta as-etiqueta-ok">Pago</span>
                      </td>
                    </tr>
                  ))}
                  {h.itens.length === 0 && (
                    <tr>
                      <td colSpan={4}>Nenhum pagamento registrado ainda.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="as-total">
              <span>
                Exibindo os últimos {h.itens.length} pagamentos processados.
              </span>
              <span>
                Total liquidado no período:{' '}
                <strong>{moeda(h.totalPeriodo)}</strong>
              </span>
            </p>
          </section>

          <div className="as-grade-2">
            <Link to="/associado" className="as-botao as-botao-claro">
              ← Voltar para meus boletos
            </Link>
            <p className="as-cartao as-autenticidade">
              <strong>Autenticidade Garantida</strong>
              <span>
                Comprovantes assinados digitalmente pela autoridade sindical.
              </span>
            </p>
          </div>
          <p className="as-cartao as-ajuda">
            Precisa de auxílio com pagamentos ou comprovantes? Ligue para a
            Central Sindical Gratuita: <strong>0800 724 3000</strong>
          </p>
        </>
      )}
    </>
  );
}
