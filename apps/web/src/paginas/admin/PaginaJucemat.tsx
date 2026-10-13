import { useState } from 'react';
import { useTituloPagina } from '../../componentes';
import { api } from '../../api';
import { AvisoCarga, CabecalhoAdmin, TopoAdmin } from './ComponentesAdmin';
import {
  cnpjMascarado,
  data,
  executarAdmin,
  useDadosAdmin,
} from './useDadosAdmin';

/** Fila de cancelamentos e informações sobre a cobrança formal. */
export function PaginaJucemat() {
  useTituloPagina('Cancelamentos e cobrança formal');
  const [mensagem, setMensagem] = useState<string | null>(null);
  const {
    dados: fila,
    erro,
    carregando,
    definir,
  } = useDadosAdmin((token) => api.admin.cancelamentos(token), []);

  return (
    <>
      <TopoAdmin />
      <CabecalhoAdmin
        titulo="Cancelamentos e cobrança formal"
        descricao="Analise solicitações de cancelamento e consulte o envio de comunicados aos associados."
      />

      <section className="adm-cartao adm-lista" aria-labelledby="t-fila">
        <h2 id="t-fila" className="adm-bloco-titulo adm-fila-titulo">
          Solicitações de cancelamento
          <span className="adm-etiqueta adm-etiqueta-azul">
            {fila?.length ?? 0} pendentes
          </span>
        </h2>
        <AvisoCarga carregando={carregando} erro={erro} />
        {mensagem && (
          <p className="adm-aviso" role="status">
            {mensagem}
          </p>
        )}
        <div className="adm-tabela-rolagem">
          <table className="adm-tabela">
            <thead>
              <tr>
                <th scope="col">Razão Social</th>
                <th scope="col">Data</th>
                <th scope="col" className="adm-coluna-acao">
                  Ação
                </th>
              </tr>
            </thead>
            <tbody>
              {fila?.map((s) => (
                <tr key={s.id}>
                  <td>
                    <strong>{s.razaoSocial.toUpperCase()}</strong>
                    <small className="d-block">
                      CNPJ {cnpjMascarado(s.cnpj)}
                    </small>
                  </td>
                  <td>{data(s.solicitadaEm)}</td>
                  <td className="adm-coluna-acao">
                    <button
                      type="button"
                      className="adm-botao-primario adm-botao-pequeno"
                      onClick={async () => {
                        const r = await executarAdmin((t) =>
                          api.admin.aprovarCancelamento(t, s.id),
                        );
                        if (r.dados) definir(r.dados);
                        setMensagem(
                          r.erro ??
                            `Cancelamento de ${s.razaoSocial} aprovado.`,
                        );
                      }}
                    >
                      Aprovar cancelamento
                    </button>
                  </td>
                </tr>
              ))}
              {fila && fila.length === 0 && (
                <tr>
                  <td colSpan={3} className="adm-sem-resultado">
                    Nenhum cancelamento pendente.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="adm-cartao adm-bloco" aria-labelledby="t-jucemat">
        <h2 id="t-jucemat" className="adm-bloco-titulo">
          Cobrança formal
        </h2>
        <p className="adm-bloco-sub">
          O comunicado informa a existência do sindicato, o valor da
          contribuição e os benefícios. É enviado por e-mail à base de
          associados, sem boleto.
        </p>
        <p className="adm-bloco-sub">
          A base deve ser importada de arquivo XML da JUCEMAT, filtrado pelo
          CNAE. A importação ainda não está disponível nesta tela.
        </p>
        <div className="adm-formulario-acoes">
          <button
            type="button"
            className="adm-botao-primario"
            disabled
            title="O envio ainda não está disponível nesta tela."
          >
            Envio indisponível
          </button>
        </div>
      </section>
    </>
  );
}
