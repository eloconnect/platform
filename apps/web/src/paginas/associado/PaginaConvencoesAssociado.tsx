import { useState } from 'react';
import { api } from '../../api';
import { useTituloPagina } from '../../componentes';
import { AvisoCarga } from '../admin/ComponentesAdmin';
import { data, executarAdmin, useDadosAdmin } from '../admin/useDadosAdmin';
import { Cabecalho } from './componentes';

/** Resumos e anexos publicados pela sede. */
export function PaginaConvencoesAssociado() {
  useTituloPagina('Convenções Coletivas');
  const {
    dados: lista,
    definir: definirLista,
    erro,
    carregando,
  } = useDadosAdmin((token) => api.associado.convencoes(token), []);
  const vigente = lista?.[0];
  const [baixando, setBaixando] = useState<string | null>(null);
  const [erroDownload, setErroDownload] = useState<string | null>(null);
  const [inscrevendo, setInscrevendo] = useState<string | null>(null);
  const [mensagemInscricao, setMensagemInscricao] = useState<string | null>(
    null,
  );

  async function inscrever(convencaoId: string) {
    setInscrevendo(convencaoId);
    setMensagemInscricao(null);
    const resultado = await executarAdmin((token) =>
      api.associado.inscreverConvencao(token, convencaoId),
    );
    if (!resultado.dados) {
      setMensagemInscricao(
        resultado.erro ?? 'Não foi possível registrar a inscrição.',
      );
      setInscrevendo(null);
      return;
    }
    const recarga = await executarAdmin((token) =>
      api.associado.convencoes(token),
    );
    if (recarga.dados) definirLista(recarga.dados);
    setMensagemInscricao(
      recarga.erro
        ? 'Inscrição registrada, mas não foi possível atualizar a página.'
        : 'Inscrição registrada.',
    );
    setInscrevendo(null);
  }

  async function baixarAnexo(
    convencaoId: string,
    anexoId: string,
    nomeArquivo: string,
  ) {
    const chave = `${convencaoId}:${anexoId}`;
    setBaixando(chave);
    setErroDownload(null);
    const resultado = await executarAdmin((token) =>
      api.associado.baixarAnexoConvencao(token, convencaoId, anexoId),
    );
    if (!resultado.dados) {
      setErroDownload(resultado.erro ?? 'Não foi possível baixar o arquivo.');
      setBaixando(null);
      return;
    }
    const url = URL.createObjectURL(resultado.dados);
    const link = document.createElement('a');
    link.href = url;
    link.download = nomeArquivo;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setBaixando(null);
  }

  const arquivos = (convencao: NonNullable<typeof lista>[number]) =>
    convencao.arquivos.length > 0 ? (
      <ul className="as-lista-arquivos">
        {convencao.arquivos.map((arquivo) => {
          const chave = `${convencao.id}:${arquivo.id}`;
          return (
            <li key={arquivo.id}>
              <span>{arquivo.nomeArquivo}</span>
              <button
                className="as-botao as-botao-pequeno"
                type="button"
                disabled={baixando === chave}
                onClick={() =>
                  baixarAnexo(convencao.id, arquivo.id, arquivo.nomeArquivo)
                }
              >
                {baixando === chave ? 'Baixando…' : 'Baixar PDF'}
              </button>
            </li>
          );
        })}
      </ul>
    ) : (
      <p className="as-total">Sem arquivo anexado até o momento.</p>
    );

  const acaoInscricao = (convencao: NonNullable<typeof lista>[number]) => {
    if (convencao.inscrito) {
      return <p className="as-aviso">Inscrição registrada.</p>;
    }
    if (!convencao.podeInscrever) {
      return (
        <p className="as-descricao">
          A inscrição é exclusiva para afiliados em dia.
        </p>
      );
    }
    return (
      <button
        className="as-botao as-botao-largo"
        type="button"
        disabled={inscrevendo === convencao.id}
        onClick={() => void inscrever(convencao.id)}
      >
        {inscrevendo === convencao.id ? 'Registrando…' : 'Inscrever-se'}
      </button>
    );
  };

  return (
    <>
      <Cabecalho
        selo="INFORMAÇÕES PARA ASSOCIADOS"
        titulo="Convenções Coletivas"
        descricao="Consulte os resumos e anexos das convenções coletivas publicados pela sede."
      />
      <AvisoCarga carregando={carregando} erro={erro} />
      {erroDownload && (
        <p className="as-aviso" role="alert">
          {erroDownload}
        </p>
      )}
      {mensagemInscricao && (
        <p className="as-aviso" role="status">
          {mensagemInscricao}
        </p>
      )}
      {lista?.length === 0 && (
        <p className="as-aviso" role="status">
          Nenhuma convenção foi publicada pela sede ainda.
        </p>
      )}

      {vigente && (
        <section className="as-cartao" aria-labelledby="t-convencao">
          <div className="as-linha-titulo">
            <div>
              <h2 id="t-convencao">{vigente.titulo}</h2>
              <p className="as-descricao">{vigente.resumo}</p>
            </div>
            <span className="as-etiqueta as-etiqueta-ok">
              Publicada em {data(vigente.publicadaEm)}
            </span>
          </div>
          {arquivos(vigente)}
          {acaoInscricao(vigente)}
        </section>
      )}

      {lista && lista.length > 1 && (
        <section className="as-cartao" aria-labelledby="t-outras">
          <h2 id="t-outras">Convenções anteriores</h2>
          <ul className="as-lista">
            {lista.slice(1).map((c) => (
              <li key={c.id}>
                <strong>{c.titulo}</strong> <small>({c.ano})</small>
                {arquivos(c)}
                {acaoInscricao(c)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
