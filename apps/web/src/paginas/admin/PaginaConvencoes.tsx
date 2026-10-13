import { useTituloPagina } from '../../componentes';
import { api } from '../../api';
import { AvisoCarga, CabecalhoAdmin, TopoAdmin } from './ComponentesAdmin';
import { IconeDocumento, IconeUpload } from './icones';
import { data, useDadosAdmin } from './useDadosAdmin';

/** Publicação de convenções coletivas e lista das vigentes. */
export function PaginaConvencoes() {
  useTituloPagina('Convenções & Benefícios');
  const {
    dados: lista,
    erro,
    carregando,
  } = useDadosAdmin((token) => api.admin.convencoes(token), []);

  return (
    <>
      <TopoAdmin />
      <CabecalhoAdmin
        selo="SEDE PATRONAL • GESTÃO JURÍDICA & SINDICAL"
        titulo="Publicador de Convenções Coletivas e Benefícios"
        descricao="Gerencie os acordos salariais vigentes, tabela de pisos e catálogo de vantagens visíveis no portal e na vitrine pública."
      />

      <section className="adm-cartao adm-bloco" aria-labelledby="t-nova">
        <h2 id="t-nova" className="adm-bloco-titulo adm-bloco-barra">
          Nova Publicação de CCT &amp; Homologação Salarial
        </h2>
        <form className="adm-formulario" onSubmit={(e) => e.preventDefault()}>
          <label>
            <span>Título da CCT *</span>
            <input
              type="text"
              placeholder="Convenção Coletiva de Trabalho 2025/2026"
            />
          </label>
          <div className="adm-campos-2">
            <label>
              <span>Período de Vigência *</span>
              <input type="date" />
            </label>
            <label>
              <span>Fim da Vigência *</span>
              <input type="date" />
            </label>
          </div>
          <div
            className="adm-envio"
            role="group"
            aria-label="Instrumento homologado (PDF)"
          >
            <IconeUpload />
            <strong>Selecione ou arraste o arquivo PDF aqui</strong>
            <span>PDF homologado com certificação digital (máx. 40MB)</span>
          </div>
          <div className="adm-formulario-acoes">
            <button
              type="button"
              className="adm-botao-primario"
              disabled
              title="A publicação depende do armazenamento de arquivos (#28)"
            >
              Publicar Convenção Oficial
            </button>
          </div>
        </form>
      </section>

      <section className="adm-cartao adm-bloco" aria-labelledby="t-vigentes">
        <h2 id="t-vigentes" className="adm-bloco-titulo">
          Convenções Coletivas Vigentes
        </h2>
        <p className="adm-bloco-sub">Documentos oficiais atualmente ativos</p>
        <AvisoCarga carregando={carregando} erro={erro} />
        <ul className="adm-lista-itens">
          {lista?.map((c) => (
            <li key={c.id} className="adm-item-convencao">
              <span className="adm-icone-linha" aria-hidden="true">
                <IconeDocumento />
              </span>
              <div>
                <strong>{c.titulo}</strong>
                <small>
                  Ano {c.ano} • Publicada em {data(c.publicadaEm)} • {c.anexos}{' '}
                  anexo(s)
                </small>
              </div>
              <span className="adm-etiqueta adm-etiqueta-azul">Vigente</span>
            </li>
          ))}
          {lista && lista.length === 0 && (
            <li className="adm-sem-resultado">Nenhuma convenção publicada.</li>
          )}
        </ul>
      </section>
    </>
  );
}
