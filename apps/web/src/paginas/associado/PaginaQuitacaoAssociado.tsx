import type { SituacaoQuitacao } from '@eloconnect/shared';
import { ApiError, formatarReais, textoCompetencia } from '@eloconnect/shared';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api } from '../../api';
import {
  AvisoSucesso,
  Botao,
  Carregando,
  MensagemErro,
  useTituloPagina,
} from '../../componentes';

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'erro' }
  | { tipo: 'ok'; situacao: SituacaoQuitacao };

const LINK_BOLETOS = (
  <Link className="btn btn-primary btn-lg" to="/associado/boletos">
    Ver meus boletos
  </Link>
);

/**
 * Boleto único dos meses em aberto (US34: RF37, RN30): para voltar a ficar em
 * dia, o associado pede um boleto só com todos os meses expirados, sem juros.
 * O pedido passa pela sede; aprovado, o boleto chega por e-mail e aparece em
 * "Meus boletos".
 */
export function PaginaQuitacaoAssociado() {
  useTituloPagina('Voltar a ficar em dia');
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' });
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    let ativo = true;
    void api
      .situacaoQuitacao()
      .then((situacao) => ativo && setEstado({ tipo: 'ok', situacao }))
      .catch(() => ativo && setEstado({ tipo: 'erro' }));
    return () => {
      ativo = false;
    };
  }, []);

  async function pedir() {
    setErro(null);
    setEnviando(true);
    try {
      const situacao = await api.pedirQuitacao();
      setEstado({ tipo: 'ok', situacao });
      setAviso('Pedido enviado. A sede vai responder.');
    } catch (e) {
      setErro(
        e instanceof ApiError && e.status < 500
          ? e.message
          : 'Não foi possível enviar o pedido agora. Tente de novo em alguns minutos.',
      );
    } finally {
      setEnviando(false);
    }
  }

  const situacao = estado.tipo === 'ok' ? estado.situacao : null;
  const pendente = situacao?.pedido?.status === 'PENDENTE';
  const recusado = situacao?.pedido?.status === 'RECUSADO';
  return (
    <>
      <h1>Voltar a ficar em dia</h1>
      {aviso && <AvisoSucesso>{aviso}</AvisoSucesso>}
      {estado.tipo === 'carregando' && <Carregando texto="Carregando..." />}
      {estado.tipo === 'erro' && (
        <MensagemErro>
          Não foi possível carregar esta página agora. Tente de novo em alguns
          minutos.
        </MensagemErro>
      )}
      {situacao?.boletoEmAberto && (
        <>
          <p>
            O boleto dos meses em aberto já saiu. Pague esse boleto para a
            farmácia voltar a ficar em dia.
          </p>
          {LINK_BOLETOS}
        </>
      )}
      {situacao && !situacao.boletoEmAberto && !situacao.meses.length && (
        <>
          <p>
            A farmácia não tem meses em aberto. Se houver um boleto para pagar,
            ele está em &quot;Meus boletos&quot;.
          </p>
          {LINK_BOLETOS}
        </>
      )}
      {situacao && !situacao.boletoEmAberto && situacao.meses.length > 0 && (
        <>
          <p>
            Para voltar a ficar em dia, a farmácia paga todos os meses em aberto
            num boleto só, sem juros e sem multa.
          </p>
          <section className="elo-boleto" aria-labelledby="titulo-meses">
            <h2 id="titulo-meses">Meses em aberto</h2>
            <ul className="list-unstyled mb-3">
              {situacao.meses.map((mes) => (
                <li
                  key={`${mes.competencia.ano}-${mes.competencia.mes}`}
                  className="d-flex justify-content-between gap-3 py-1"
                >
                  <span>{textoCompetencia(mes.competencia)}</span>
                  <span>{formatarReais(mes.valor)}</span>
                </li>
              ))}
            </ul>
            <dl>
              <div>
                <dt>Total</dt>
                <dd className="elo-valor">{formatarReais(situacao.total)}</dd>
              </div>
            </dl>
          </section>
          {pendente ? (
            <p>
              O pedido foi enviado em{' '}
              {new Date(situacao.pedido!.solicitadoEm).toLocaleDateString(
                'pt-BR',
              )}
              . A sede vai responder. Quando ela aprovar, o boleto chega por
              e-mail e aparece em &quot;Meus boletos&quot;.
            </p>
          ) : (
            <>
              {recusado && (
                <p>
                  A sede recusou o último pedido. Para saber mais, fale com a
                  sede do sindicato.
                </p>
              )}
              <p>
                O pedido passa pela sede. Quando ela aprovar, o boleto chega por
                e-mail e aparece em &quot;Meus boletos&quot;.
              </p>
              {erro && <MensagemErro>{erro}</MensagemErro>}
              <Botao onClick={() => void pedir()} disabled={enviando}>
                {enviando
                  ? 'Enviando...'
                  : 'Pedir o boleto dos meses em aberto'}
              </Botao>
            </>
          )}
        </>
      )}
    </>
  );
}
