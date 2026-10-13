import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../../api';
import { useTituloPagina } from '../../componentes';
import { AvisoCarga } from '../admin/ComponentesAdmin';
import { executarAdmin, useDadosAdmin } from '../admin/useDadosAdmin';
import { Cabecalho } from './componentes';

/** Benefícios cadastrados pela sede para associados adimplentes. */
export function PaginaBeneficios() {
  useTituloPagina('Benefícios & Suporte');
  const {
    dados: lista,
    erro,
    carregando,
  } = useDadosAdmin((token) => api.associado.beneficios(token), []);
  const conta = useDadosAdmin((token) => api.associado.painel(token), []);
  const [mensagemSolicitacao, setMensagemSolicitacao] = useState('');
  const [resultadoSolicitacao, setResultadoSolicitacao] = useState<
    string | null
  >(null);
  const [enviando, setEnviando] = useState(false);
  const podeSolicitar = conta.dados?.farmacia.situacao === 'EM_DIA';
  const inelegivel = conta.dados !== null && !podeSolicitar;

  async function solicitarSuporte(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setEnviando(true);
    setResultadoSolicitacao(null);
    const resultado = await executarAdmin((token) =>
      api.associado.solicitarSuporte(token, mensagemSolicitacao),
    );
    setResultadoSolicitacao(
      resultado.erro ?? 'Sua solicitação foi enviada para a sede.',
    );
    if (resultado.dados) setMensagemSolicitacao('');
    setEnviando(false);
  }

  return (
    <>
      <Cabecalho
        selo="ÁREA DO ASSOCIADO"
        titulo="Benefícios e suporte"
        descricao="Benefícios e suporte jurídico particular são exclusivos para afiliados em dia."
      />
      <AvisoCarga
        carregando={conta.carregando || carregando}
        erro={
          inelegivel
            ? conta.erro
            : (conta.erro ?? (podeSolicitar ? erro : null))
        }
      />
      {inelegivel && !conta.erro && (
        <p className="as-aviso" role="status">
          O acesso a benefícios e ao suporte jurídico particular é exclusivo
          para afiliados em dia.
        </p>
      )}
      {lista?.length === 0 && (
        <p className="as-aviso" role="status">
          Nenhum benefício foi cadastrado pela sede.
        </p>
      )}
      <div className="as-grade-2">
        {lista?.map((b) => (
          <section key={b.id} className="as-cartao as-opcao">
            <h2>{b.titulo}</h2>
            <p>{b.descricao}</p>
          </section>
        ))}
      </div>
      {podeSolicitar && (
        <section className="as-cartao" aria-labelledby="t-suporte-juridico">
          <h2 id="t-suporte-juridico">Solicitar suporte jurídico particular</h2>
          <p className="as-descricao">
            Envie sua solicitação para acompanhamento pela sede.
          </p>
          <form className="as-formulario" onSubmit={solicitarSuporte}>
            <label>
              <span>Descreva sua solicitação</span>
              <textarea
                required
                maxLength={5000}
                rows={5}
                value={mensagemSolicitacao}
                onChange={(evento) =>
                  setMensagemSolicitacao(evento.currentTarget.value)
                }
              />
            </label>
            {resultadoSolicitacao && (
              <p className="as-aviso" role="status">
                {resultadoSolicitacao}
              </p>
            )}
            <button
              className="as-botao as-botao-largo"
              type="submit"
              disabled={enviando || !mensagemSolicitacao.trim()}
            >
              {enviando ? 'Enviando…' : 'Enviar solicitação'}
            </button>
          </form>
        </section>
      )}
    </>
  );
}
