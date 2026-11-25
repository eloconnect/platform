import type { MotivoSemAvulso, SituacaoAvulso } from '@eloconnect/shared';
import { ApiError, formatarDia, formatarReais } from '@eloconnect/shared';
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
  | { tipo: 'ok'; situacao: SituacaoAvulso };

/** Por que não dá para pedir agora, em linguagem direta. */
const TEXTO_MOTIVO: Record<MotivoSemAvulso, string> = {
  RECEBE_BOLETO_MENSAL:
    'A farmácia já recebe o boleto todo mês. O boleto deste mês está em "Meus boletos".',
  BOLETO_EM_ABERTO:
    'A farmácia já tem um boleto para pagar. Ele está em "Meus boletos".',
  BOLETO_EXPIRADO:
    'A farmácia tem meses em aberto. Para voltar a ficar em dia, pague todos num boleto só, sem juros.',
  MES_JA_PAGO: 'O boleto deste mês já foi pago. Não é preciso pagar de novo.',
  PLANO_ANUAL: 'O plano anual da farmácia já cobre este mês.',
  SEM_VALOR:
    'O boleto ainda não está disponível. Fale com a sede do sindicato.',
  INATIVO: 'O cadastro da farmácia está inativo. Fale com a sede do sindicato.',
};

/**
 * Boleto avulso (US34: RF37, RN24): quem não recebe o boleto todo mês paga só
 * o mês atual. O boleto sai na hora e fica em "Meus boletos", sem e-mail.
 */
export function PaginaAvulsoAssociado() {
  useTituloPagina('Pagar só este mês');
  const navegar = useNavigate();
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' });
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    void api
      .situacaoAvulso()
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
      await api.pedirAvulso();
      void navegar('/associado/boletos', {
        state: {
          aviso:
            'Pronto! O boleto deste mês está aqui. Ele não chega por e-mail.',
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
  return (
    <>
      <h1>Pagar só este mês</h1>
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
      {situacao && !situacao.motivo && situacao.valor && (
        <>
          <p>
            O boleto vale só para este mês. Ele não chega por e-mail: fica na
            página &quot;Meus boletos&quot;, com o Pix e o código de barras.
          </p>
          <section className="elo-boleto" aria-labelledby="titulo-avulso">
            <h2 id="titulo-avulso">Boleto deste mês</h2>
            <div className="elo-boleto-corpo">
              <dl>
                <div>
                  <dt>Valor</dt>
                  <dd className="elo-valor">{formatarReais(situacao.valor)}</dd>
                </div>
                <div>
                  <dt>Vencimento</dt>
                  <dd>{formatarDia(situacao.vencimento)}</dd>
                </div>
              </dl>
            </div>
          </section>
          <p>
            Com o boleto pago, a farmácia fica em dia até{' '}
            <strong>{formatarDia(situacao.emDiaAte)}</strong>.
          </p>
          {erro && <MensagemErro>{erro}</MensagemErro>}
          <Botao onClick={() => void pedir()} disabled={enviando}>
            {enviando ? 'Gerando o boleto...' : 'Gerar o boleto'}
          </Botao>
        </>
      )}
    </>
  );
}
