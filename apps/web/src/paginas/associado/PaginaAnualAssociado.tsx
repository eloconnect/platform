import type { MotivoSemAnual, SituacaoAnual } from '@eloconnect/shared';
import {
  ApiError,
  formatarDia,
  formatarReais,
  textoCompetencia,
} from '@eloconnect/shared';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { api } from '../../api';
import {
  Botao,
  Carregando,
  MensagemErro,
  useTituloPagina,
} from '../../componentes';

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'erro' }
  | { tipo: 'ok'; situacao: SituacaoAnual };

/** Por que não dá para pedir agora, em linguagem direta. */
const TEXTO_MOTIVO: Record<MotivoSemAnual, string> = {
  PLANO_EM_VIGOR: 'O plano anual da farmácia ainda está valendo.',
  BOLETO_EM_ABERTO:
    'A farmácia já tem um boleto para pagar. Ele está em "Meus boletos".',
  BOLETO_EXPIRADO:
    'A farmácia tem meses em aberto. Para voltar a ficar em dia, pague todos num boleto só, sem juros.',
  SEM_VALOR:
    'O plano anual ainda não está disponível. Fale com a sede do sindicato.',
  INATIVO: 'O cadastro da farmácia está inativo. Fale com a sede do sindicato.',
};

/**
 * Plano anual à vista, com 20% de desconto (US17: RF17, RN13). O boleto sai
 * na hora e fica em "Meus boletos", como o avulso.
 */
export function PaginaAnualAssociado() {
  useTituloPagina('Pagar o ano à vista');
  const navegar = useNavigate();
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' });
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    void api
      .situacaoAnual()
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
      await api.pedirAnual();
      void navegar('/associado/boletos', {
        state: {
          aviso:
            'Pronto! O boleto do plano anual está aqui. Ele não chega por e-mail.',
        },
      });
    } catch (e) {
      setErro(
        e instanceof ApiError && e.status < 500
          ? e.message
          : 'Não foi possível gerar o boleto agora. Tente de novo em alguns minutos.',
      );
      setEnviando(false);
    }
  }

  const situacao = estado.tipo === 'ok' ? estado.situacao : null;
  const economia =
    situacao?.valorAnual && situacao.valorMensal
      ? (
          Number(situacao.valorMensal) * 12 -
          Number(situacao.valorAnual)
        ).toFixed(2)
      : null;
  return (
    <>
      <h1>Pagar o ano à vista</h1>
      {estado.tipo === 'carregando' && <Carregando texto="Carregando..." />}
      {estado.tipo === 'erro' && (
        <MensagemErro>
          Não foi possível carregar esta página agora. Tente de novo em alguns
          minutos.
        </MensagemErro>
      )}
      {situacao?.motivo && (
        <>
          <p>{TEXTO_MOTIVO[situacao.motivo]}</p>
          {situacao.planoAte && (
            <p>
              Ele cobre até{' '}
              <strong>{textoCompetencia(situacao.planoAte)}</strong>.
            </p>
          )}
          {situacao.motivo === 'BOLETO_EXPIRADO' ? (
            <Link
              className="btn btn-primary btn-lg"
              to="/associado/meses-em-aberto"
            >
              Pagar os meses em aberto
            </Link>
          ) : (
            <Link className="btn btn-primary btn-lg" to="/associado/boletos">
              Ver meus boletos
            </Link>
          )}
        </>
      )}
      {situacao && !situacao.motivo && situacao.valorAnual && (
        <>
          <p>
            Pague os 12 meses de uma vez, com 20% de desconto. O boleto não
            chega por e-mail: fica na página &quot;Meus boletos&quot;.
          </p>
          <section className="elo-boleto" aria-labelledby="titulo-anual">
            <h2 id="titulo-anual">
              De {textoCompetencia(situacao.primeiroMes)} a{' '}
              {textoCompetencia(situacao.ultimoMes)}
            </h2>
            <div className="elo-boleto-corpo">
              <dl>
                <div>
                  <dt>Valor do ano</dt>
                  <dd className="elo-valor">
                    {formatarReais(situacao.valorAnual)}
                  </dd>
                </div>
                <div>
                  <dt>Vencimento</dt>
                  <dd>{formatarDia(situacao.vencimento)}</dd>
                </div>
              </dl>
            </div>
            {economia && Number(economia) > 0 && (
              <p className="mt-3 mb-0">
                Você economiza {formatarReais(economia)} em relação a 12 boletos
                mensais.
              </p>
            )}
          </section>
          <p>
            Nesses meses, a farmácia não recebe o boleto mensal. Depois deles,
            quem recebe o boleto todo mês volta a recebê-lo.
          </p>
          {erro && <MensagemErro>{erro}</MensagemErro>}
          <Botao onClick={() => void pedir()} disabled={enviando}>
            {enviando ? 'Gerando o boleto...' : 'Gerar o boleto do ano'}
          </Botao>
        </>
      )}
    </>
  );
}
