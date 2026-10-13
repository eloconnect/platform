import { Link } from 'react-router';
import { api } from '../../api';
import { useTituloPagina } from '../../componentes';
import { AvisoCarga } from '../admin/ComponentesAdmin';
import { data, moeda, useDadosAdmin } from '../admin/useDadosAdmin';
import { Cabecalho } from './componentes';

/** Pisos salariais da convenção vigente e acesso à gestão de filiação. */
export function PaginaConvencoesAssociado() {
  useTituloPagina('Convenções Coletivas');
  const {
    dados: lista,
    erro,
    carregando,
  } = useDadosAdmin((token) => api.associado.convencoes(token), []);
  const vigente = lista?.[0];

  return (
    <>
      <Cabecalho
        selo="DOCUMENTOS TRABALHISTAS E EVENTOS OFICIAIS"
        titulo="Convenções Coletivas de Trabalho"
        descricao="Consulte os pisos salariais vigentes da categoria."
      />
      <AvisoCarga carregando={carregando} erro={erro} />
      {lista?.length === 0 && (
        <p className="as-aviso" role="status">
          Nenhuma convenção foi publicada pela sede ainda.
        </p>
      )}

      {vigente && (
        <section className="as-cartao" aria-labelledby="t-pisos">
          <div className="as-linha-titulo">
            <div>
              <h2 id="t-pisos">{vigente.titulo}</h2>
              <p className="as-descricao">{vigente.resumo}</p>
            </div>
            <span className="as-etiqueta as-etiqueta-ok">
              Vigente desde {data(vigente.publicadaEm)}
            </span>
          </div>
          {vigente.pisos.length > 0 && (
            <div className="as-tabela-rolagem">
              <table className="as-tabela">
                <thead>
                  <tr>
                    <th scope="col">Cargo / Função Regulamentada</th>
                    <th scope="col">Piso Anterior</th>
                    <th scope="col">Piso Mínimo Garantido</th>
                  </tr>
                </thead>
                <tbody>
                  {vigente.pisos.map((p) => (
                    <tr key={p.funcao}>
                      <th scope="row">{p.funcao}</th>
                      <td>{p.pisoAnterior ? moeda(p.pisoAnterior) : '—'}</td>
                      <td className="as-destaque">{moeda(p.pisoNovo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="as-total">
            <span>
              {vigente.anexos > 0
                ? `${vigente.anexos} arquivo(s) anexado(s) pela sede.`
                : 'Sem arquivo anexado até o momento.'}
            </span>
          </p>
        </section>
      )}

      {lista && lista.length > 1 && (
        <section className="as-cartao" aria-labelledby="t-outras">
          <h2 id="t-outras">Convenções anteriores</h2>
          <ul className="as-lista">
            {lista.slice(1).map((c) => (
              <li key={c.id}>
                <strong>{c.titulo}</strong> <small>({c.ano})</small>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="as-cartao as-filiacao">
        <div>
          <p className="as-etiqueta">PRINCIPAL SERVIÇO</p>
          <h2>Gestão de Filiação</h2>
          <p className="as-descricao">
            Gerencie sua condição de associado, consulte termos de filiação ou
            solicite alterações cadastrais da farmácia sem burocracia.
          </p>
        </div>
        <Link to="/associado/filiacao" className="as-botao">
          Acessar Gestão de Filiação →
        </Link>
      </section>
    </>
  );
}
