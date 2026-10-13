import { useState } from 'react';
import { useTituloPagina } from '../../componentes';
import { api } from '../../api';
import { AvisoCarga, CabecalhoAdmin, TopoAdmin } from './ComponentesAdmin';
import { IconeUpload } from './icones';
import {
  cnpjMascarado,
  data,
  executarAdmin,
  useDadosAdmin,
} from './useDadosAdmin';

/** Fila de cancelamentos e notificação formal JUCEMAT. */
export function PaginaJucemat() {
  useTituloPagina('Gestão JUCEMAT');
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
        selo="SEDE ADMINISTRATIVA • MÓDULO JURÍDICO E CADASTRAL"
        titulo="Gestão de Cancelamentos e Cobrança Formal"
        descricao="Validação de desfiliações pendentes e emissão de notificações JUCEMAT."
      />

      <section className="adm-cartao adm-lista" aria-labelledby="t-fila">
        <h2 id="t-fila" className="adm-bloco-titulo adm-fila-titulo">
          Fila de Cancelamentos
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
                          r.erro ?? `Desfiliação de ${s.razaoSocial} aprovada.`,
                        );
                      }}
                    >
                      Aprovar Desfiliação
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
          Notificação Formal JUCEMAT
        </h2>
        <div
          className="adm-envio"
          role="group"
          aria-label="Arquivo XML da JUCEMAT"
        >
          <IconeUpload />
          <strong>Carregar arquivo XML da JUCEMAT</strong>
          <span>Arraste o arquivo ou clique para selecionar</span>
        </div>
        <div className="adm-formulario-acoes">
          <button
            type="button"
            className="adm-botao-primario"
            disabled
            title="O disparo depende da integração com a JUCEMAT"
          >
            Disparar Notificação Formal
          </button>
        </div>
      </section>
    </>
  );
}
