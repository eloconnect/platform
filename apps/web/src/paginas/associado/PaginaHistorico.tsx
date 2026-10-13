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
        descricao="Consulte os pagamentos registrados para a sua farmácia."
      />
      <AvisoCarga carregando={carregando} erro={erro} />

      {h && (
        <>
          <section
            className="as-cartao as-situacao"
            aria-label="Situação da contribuição"
          >
            <div>
              <p className="as-situacao-titulo">
                Situação da contribuição:{' '}
                <em className={h.emDia ? 'as-ok' : 'as-alerta'}>
                  {h.emDia ? 'Adimplente' : 'Inadimplente'}
                </em>
              </p>
              <p className="as-descricao">
                {h.emDia
                  ? 'A contribuição está em dia.'
                  : 'A contribuição não está em dia.'}
              </p>
            </div>
          </section>

          <section className="as-cartao" aria-labelledby="t-quitadas">
            <div className="as-linha-titulo">
              <div>
                <h2 id="t-quitadas">Pagamentos registrados</h2>
              </div>
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
          </section>

          <Link to="/associado" className="as-botao as-botao-claro">
            Voltar para boletos
          </Link>
        </>
      )}
    </>
  );
}
