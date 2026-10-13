import { useState } from 'react';
import { Link } from 'react-router';
import { api } from '../../api';
import { useTituloPagina } from '../../componentes';
import { AvisoCarga } from '../admin/ComponentesAdmin';
import { executarAdmin, useDadosAdmin } from '../admin/useDadosAdmin';

/** Pedido de cancelamento com os benefícios atualmente cadastrados pela sede. */
export function PaginaCancelamento() {
  useTituloPagina('Solicitar cancelamento');
  const [ciente, setCiente] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const {
    dados: p,
    erro,
    carregando,
    definir,
  } = useDadosAdmin((token) => api.associado.painel(token), []);
  const beneficios = useDadosAdmin(
    (token) => api.associado.beneficios(token),
    [],
  );

  async function confirmar() {
    const r = await executarAdmin((t) =>
      api.associado.solicitarCancelamento(t),
    );
    if (r.dados) definir(r.dados);
    setMensagem(
      r.erro ??
        'Pedido enviado. A sede vai analisar e confirmar o encerramento.',
    );
  }

  return (
    <>
      <nav className="as-migalhas" aria-label="Você está em">
        <Link to="/associado">‹ Voltar ao portal</Link>
        <span>Solicitar cancelamento</span>
      </nav>
      <section className="as-cartao as-atencao">
        <p className="as-selo">SOLICITAÇÃO DO ASSOCIADO</p>
        <h1>Solicitar cancelamento</h1>
        <p className="as-descricao">
          A sede receberá e validará sua solicitação. Se aprovada, sua farmácia
          deixará de receber cobranças recorrentes e perderá o acesso aos
          benefícios e ao suporte destinados a associados adimplentes.
        </p>
      </section>
      <AvisoCarga carregando={carregando} erro={erro} />
      <AvisoCarga carregando={beneficios.carregando} erro={beneficios.erro} />
      {mensagem && (
        <p className="as-aviso" role="status">
          {mensagem}
        </p>
      )}

      <section className="as-cartao" aria-labelledby="t-resumo">
        <h2 id="t-resumo">Benefícios cadastrados pela sede</h2>
        {beneficios.dados?.length ? (
          <ul className="as-perdas">
            {beneficios.dados.map((beneficio) => (
              <li key={beneficio.id}>
                <strong>{beneficio.titulo}</strong>
                <span>{beneficio.descricao}</span>
              </li>
            ))}
          </ul>
        ) : (
          !beneficios.carregando && (
            <p className="as-descricao">
              A sede ainda não cadastrou a lista de benefícios.
            </p>
          )
        )}
        <p className="as-descricao">
          O acesso ao suporte para associados adimplentes também será encerrado
          se a solicitação for aprovada.
        </p>
      </section>

      <Link to="/associado" className="as-botao as-botao-largo">
        Voltar ao portal
      </Link>

      <section className="as-cartao as-confirmacao">
        {p?.cancelamentoPendente ? (
          <p role="status">
            <strong>Pedido em análise.</strong> A sede já recebeu sua
            solicitação de cancelamento.
          </p>
        ) : (
          <>
            <p>
              Confirme que leu as informações. A solicitação será enviada à sede
              para validação.
            </p>
            <label className="as-checagem">
              <input
                type="checkbox"
                checked={ciente}
                onChange={(e) => setCiente(e.target.checked)}
              />
              <span>
                Li as informações sobre os benefícios e o suporte que posso
                perder se o cancelamento for aprovado.
              </span>
            </label>
            <button
              type="button"
              className="as-botao as-botao-claro as-botao-largo"
              disabled={!ciente || !p}
              onClick={() => void confirmar()}
            >
              Enviar solicitação de cancelamento
            </button>
          </>
        )}
      </section>
    </>
  );
}
