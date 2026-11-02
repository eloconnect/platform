import type { Beneficio, MinhaConta } from '@eloconnect/shared';
import {
  ApiError,
  GRUPOS_BENEFICIO,
  TEXTO_GRUPO_BENEFICIO,
} from '@eloconnect/shared';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { api } from '../../api';
import { Botao, MensagemErro, useTituloPagina } from '../../componentes';
import { PRAZO_DA_SEDE } from './cancelamento';

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'erro' }
  | { tipo: 'ok'; conta: MinhaConta; beneficios: Beneficio[] };

/**
 * Pedido de cancelamento do boleto mensal (US26: RF26, RN18). Antes de
 * confirmar, o associado vê os benefícios e o suporte que a farmácia perde.
 * O pedido passa pela sede.
 */
export function PaginaCancelamentoAssociado() {
  useTituloPagina('Cancelar o boleto mensal');
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' });

  useEffect(() => {
    let ativo = true;
    void Promise.all([api.minhaConta(), api.listarBeneficios()])
      .then(
        ([conta, beneficios]) =>
          ativo && setEstado({ tipo: 'ok', conta, beneficios }),
      )
      .catch(() => ativo && setEstado({ tipo: 'erro' }));
    return () => {
      ativo = false;
    };
  }, []);

  return (
    <>
      <h1>Cancelar o boleto mensal</h1>
      {estado.tipo === 'carregando' && <p role="status">Carregando...</p>}
      {estado.tipo === 'erro' && (
        <MensagemErro>
          Não foi possível carregar esta página agora. Tente de novo em alguns
          minutos.
        </MensagemErro>
      )}
      {estado.tipo === 'ok' && !estado.conta.recebeBoletoMensal && (
        <SemPedido>
          A farmácia não recebe o boleto mensal, então não há o que cancelar.
        </SemPedido>
      )}
      {estado.tipo === 'ok' &&
        estado.conta.recebeBoletoMensal &&
        estado.conta.cancelamentoPedidoEm && (
          <SemPedido>
            O cancelamento já foi pedido em{' '}
            {new Date(estado.conta.cancelamentoPedidoEm).toLocaleDateString(
              'pt-BR',
            )}
            . {PRAZO_DA_SEDE}
          </SemPedido>
        )}
      {estado.tipo === 'ok' &&
        estado.conta.recebeBoletoMensal &&
        !estado.conta.cancelamentoPedidoEm && (
          <Pedido beneficios={estado.beneficios} />
        )}
    </>
  );
}

/** Quando não há pedido a fazer: o motivo e o caminho de volta. */
function SemPedido({ children }: { children: ReactNode }) {
  return (
    <>
      <p>{children}</p>
      <Link className="btn btn-primary btn-lg" to="/associado">
        Voltar ao início
      </Link>
    </>
  );
}

/** O que a farmácia perde, como funciona o pedido e o botão de pedir. */
function Pedido({ beneficios }: { beneficios: Beneficio[] }) {
  const navegar = useNavigate();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function pedir() {
    setErro(null);
    setEnviando(true);
    try {
      await api.pedirCancelamento();
      void navegar('/associado', {
        state: { aviso: 'Pedido de cancelamento enviado.' },
      });
    } catch (e) {
      setErro(
        e instanceof ApiError && e.status < 500
          ? e.message
          : 'Não foi possível enviar o pedido agora. Tente de novo em alguns minutos.',
      );
      setEnviando(false);
    }
  }

  return (
    <>
      <p className="fs-5">
        Se o cancelamento for confirmado, a farmácia deixa de receber o boleto
        da contribuição e perde o acesso a:
      </p>
      <h2 className="h4">O que a farmácia perde</h2>
      {/* TODO(P06): a lista completa de benefícios vem do cliente; aqui
          aparecem os que a sede cadastrou. */}
      {GRUPOS_BENEFICIO.map((grupo) => {
        const doGrupo = beneficios.filter(
          (beneficio) => beneficio.grupo === grupo,
        );
        if (doGrupo.length === 0) return null;
        return (
          <section key={grupo}>
            <h3 className="h5">{TEXTO_GRUPO_BENEFICIO[grupo]}</h3>
            <ul>
              {doGrupo.map((beneficio) => (
                <li key={beneficio.id}>{beneficio.titulo}</li>
              ))}
            </ul>
          </section>
        );
      })}
      <h3 className="h5">Suporte e convenções</h3>
      <ul>
        <li>O suporte do sindicato</li>
        <li>
          O PDF completo das convenções coletivas (o resumo continua aberto)
        </li>
      </ul>
      <h2 className="h4">Como funciona</h2>
      <p>
        O pedido vai para a sede. {PRAZO_DA_SEDE} Até lá, a farmácia continua
        recebendo o boleto.
      </p>
      {erro && <MensagemErro>{erro}</MensagemErro>}
      <div className="d-flex flex-wrap gap-3">
        <Botao
          variant="danger"
          disabled={enviando}
          onClick={() => void pedir()}
        >
          {enviando ? 'Enviando...' : 'Pedir o cancelamento'}
        </Botao>
        <Link className="btn btn-outline-secondary btn-lg" to="/associado">
          Voltar sem cancelar
        </Link>
      </div>
    </>
  );
}
