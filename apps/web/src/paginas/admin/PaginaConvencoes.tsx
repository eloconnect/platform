import { useState } from 'react';
import type { ChangeEvent } from 'react';
import type { ConvencaoPublicada, DadosConvencao } from '@eloconnect/shared';
import { useTituloPagina } from '../../componentes';
import { api } from '../../api';
import { AvisoCarga, CabecalhoAdmin, TopoAdmin } from './ComponentesAdmin';
import { IconeDocumento } from './icones';
import { data, executarAdmin, useDadosAdmin } from './useDadosAdmin';

const ANO_LIMITE = new Date().getFullYear() + 5;

/** Cadastro, edição, publicação e anexação de PDFs pela sede. */
export function PaginaConvencoes() {
  useTituloPagina('Convenções coletivas');
  const {
    dados: lista,
    definir: definirLista,
    erro,
    carregando,
  } = useDadosAdmin((token) => api.admin.convencoes(token), []);
  const [convencaoId, setConvencaoId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState('');
  const [ano, setAno] = useState('');
  const [resumo, setResumo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);

  function limparFormulario() {
    setConvencaoId(null);
    setTitulo('');
    setAno('');
    setResumo('');
    setMensagem(null);
  }

  function editar(convencao: ConvencaoPublicada) {
    setConvencaoId(convencao.id);
    setTitulo(convencao.titulo);
    setAno(String(convencao.ano));
    setResumo(convencao.resumo);
    setMensagem(null);
  }

  async function recarregarLista() {
    const resultado = await executarAdmin((token) =>
      api.admin.convencoes(token),
    );
    if (resultado.dados) definirLista(resultado.dados);
    return resultado;
  }

  async function salvar(publicar: boolean) {
    const anoNumerico = Number(ano);
    if (
      !titulo.trim() ||
      !resumo.trim() ||
      !Number.isInteger(anoNumerico) ||
      anoNumerico < 2000 ||
      anoNumerico > ANO_LIMITE
    ) {
      setMensagem('Confira o título, o resumo e o ano da convenção.');
      return;
    }
    const dados: DadosConvencao = {
      titulo: titulo.trim(),
      ano: anoNumerico,
      resumo: resumo.trim(),
      publicar,
    };
    setSalvando(true);
    setMensagem(null);
    const resultado = await executarAdmin((token) =>
      convencaoId
        ? api.admin.atualizarConvencao(token, convencaoId, dados)
        : api.admin.criarConvencao(token, dados),
    );
    if (!resultado.dados) {
      setMensagem(resultado.erro ?? 'Não foi possível salvar a convenção.');
      setSalvando(false);
      return;
    }
    if (!convencaoId) setConvencaoId(resultado.dados.id);
    const recarga = await recarregarLista();
    setMensagem(
      recarga.erro
        ? 'Convenção salva, mas não foi possível atualizar a lista.'
        : publicar
          ? 'Convenção publicada com sucesso.'
          : 'Rascunho salvo com sucesso.',
    );
    setSalvando(false);
  }

  async function anexarPdf(evento: ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.currentTarget.files?.[0];
    evento.currentTarget.value = '';
    if (!arquivo || !convencaoId) return;
    if (!arquivo.name.toLowerCase().endsWith('.pdf')) {
      setMensagem('Selecione um arquivo PDF.');
      return;
    }
    setSalvando(true);
    setMensagem(null);
    const resultado = await executarAdmin((token) =>
      api.admin.anexarConvencaoPdf(token, convencaoId, arquivo),
    );
    if (!resultado.dados) {
      setMensagem(resultado.erro ?? 'Não foi possível anexar o PDF.');
      setSalvando(false);
      return;
    }
    const recarga = await recarregarLista();
    setMensagem(
      recarga.erro
        ? 'PDF anexado, mas não foi possível atualizar a lista.'
        : 'PDF anexado com sucesso.',
    );
    setSalvando(false);
  }

  const selecionada = lista?.find((convencao) => convencao.id === convencaoId);

  return (
    <>
      <TopoAdmin />
      <CabecalhoAdmin
        titulo="Convenções coletivas"
        descricao="Cadastre e publique o resumo e os anexos em PDF das convenções coletivas."
      />

      <section className="adm-cartao adm-bloco" aria-labelledby="t-formulario">
        <div className="adm-bloco-barra">
          <h2 id="t-formulario" className="adm-bloco-titulo">
            {convencaoId ? 'Editar convenção' : 'Cadastrar convenção'}
          </h2>
          <p className="adm-bloco-sub">
            Salve como rascunho ou publique para disponibilizar aos associados.
          </p>
        </div>
        <form
          className="adm-formulario"
          onSubmit={(evento) => evento.preventDefault()}
        >
          <div className="adm-campos-2">
            <label>
              <span>Título</span>
              <input
                required
                value={titulo}
                onChange={(evento) => setTitulo(evento.currentTarget.value)}
                maxLength={200}
              />
            </label>
            <label>
              <span>Ano</span>
              <input
                required
                type="number"
                min={2000}
                max={ANO_LIMITE}
                value={ano}
                onChange={(evento) => setAno(evento.currentTarget.value)}
              />
            </label>
          </div>
          <label>
            <span>Resumo</span>
            <textarea
              required
              value={resumo}
              onChange={(evento) => setResumo(evento.currentTarget.value)}
              maxLength={50000}
              rows={5}
            />
          </label>

          {convencaoId && (
            <label className="adm-envio">
              <IconeDocumento />
              <strong>Anexar documento PDF</strong>
              <span>Selecione um arquivo PDF para esta convenção.</span>
              <input
                type="file"
                accept="application/pdf,.pdf"
                disabled={salvando}
                onChange={anexarPdf}
              />
            </label>
          )}

          {selecionada && selecionada.arquivos.length > 0 && (
            <div>
              <strong>Arquivos anexados</strong>
              <ul className="adm-lista-itens">
                {selecionada.arquivos.map((arquivo) => (
                  <li className="adm-item-convencao" key={arquivo.id}>
                    <span className="adm-icone-linha" aria-hidden="true">
                      <IconeDocumento />
                    </span>
                    <div>
                      <strong>{arquivo.nomeArquivo}</strong>
                      <small>{Math.ceil(arquivo.tamanhoBytes / 1024)} KB</small>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {mensagem && (
            <p className="adm-mensagem" role="status">
              {mensagem}
            </p>
          )}
          <div className="adm-formulario-acoes">
            {convencaoId && (
              <button
                className="adm-botao-secundario"
                type="button"
                onClick={limparFormulario}
                disabled={salvando}
              >
                Nova convenção
              </button>
            )}
            <button
              className="adm-botao-secundario"
              type="button"
              onClick={() => salvar(false)}
              disabled={salvando}
            >
              Salvar rascunho
            </button>
            <button
              className="adm-botao-primario"
              type="button"
              onClick={() => salvar(true)}
              disabled={salvando}
            >
              {salvando ? 'Salvando…' : 'Publicar convenção'}
            </button>
          </div>
        </form>
      </section>

      <section className="adm-cartao adm-bloco" aria-labelledby="t-vigentes">
        <h2 id="t-vigentes" className="adm-bloco-titulo">
          Convenções e rascunhos
        </h2>
        <AvisoCarga carregando={carregando} erro={erro} />
        <ul className="adm-lista-itens">
          {lista?.map((convencao) => (
            <li key={convencao.id} className="adm-item-convencao">
              <span className="adm-icone-linha" aria-hidden="true">
                <IconeDocumento />
              </span>
              <div>
                <strong>{convencao.titulo}</strong>
                <small>
                  Ano {convencao.ano} •{' '}
                  {convencao.publicadaEm
                    ? `Publicada em ${data(convencao.publicadaEm)}`
                    : 'Rascunho'}{' '}
                  • {convencao.anexos} anexo(s) em PDF
                </small>
              </div>
              <button
                className="adm-botao-secundario adm-botao-pequeno"
                type="button"
                onClick={() => editar(convencao)}
              >
                Editar
              </button>
            </li>
          ))}
          {lista && lista.length === 0 && (
            <li className="adm-sem-resultado">Nenhuma convenção cadastrada.</li>
          )}
        </ul>
      </section>
    </>
  );
}
