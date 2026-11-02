import type { MinhaConta } from '@eloconnect/shared';
import { useEffect, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import { Link, useLocation } from 'react-router';
import { api } from '../../api';
import {
  AvisoSucesso,
  lerAviso,
  MensagemErro,
  useTituloPagina,
} from '../../componentes';
import { PRAZO_DA_SEDE } from './cancelamento';

/**
 * Início da área do associado: a situação dele, quando a sede liberou o
 * acesso, o aviso com a data de fim da liberação (RN11, RN22), o convite
 * para receber o boleto todo mês, para quem ainda não recebe (RN23), e, para
 * quem recebe, o caminho para cancelar ou o pedido que espera a sede (RN18).
 */
export function PaginaInicioAssociado() {
  useTituloPagina('Área do associado');
  // Aviso do pedido de cancelamento, que traz o associado para cá (RN18).
  const aviso = lerAviso(useLocation().state);
  const [conta, setConta] = useState<MinhaConta | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let ativo = true;
    void api
      .minhaConta()
      .then((resposta) => ativo && setConta(resposta))
      .catch(() => ativo && setErro(true));
    return () => {
      ativo = false;
    };
  }, []);

  return (
    <>
      <h1>Área do associado</h1>
      {aviso && <AvisoSucesso>{aviso}</AvisoSucesso>}
      {erro && (
        <MensagemErro>
          Não foi possível carregar os seus dados agora. Tente de novo em alguns
          minutos.
        </MensagemErro>
      )}
      {!erro && !conta && <p role="status">Carregando...</p>}
      {conta && (
        <>
          <p className="lead">{conta.nome}</p>
          <p>Situação: {conta.situacao}</p>
          {conta.acessoLiberadoAte && (
            <Alert variant="warning">
              <Alert.Heading as="h2" className="h5">
                Acesso liberado pela sede até{' '}
                {new Date(conta.acessoLiberadoAte).toLocaleDateString('pt-BR')}
              </Alert.Heading>
              <p className="mb-0">
                A sede liberou o seu acesso a benefícios e suporte até essa
                data. Depois dela, o acesso volta a depender do pagamento em
                dia.
              </p>
            </Alert>
          )}
          {!conta.recebeBoletoMensal && (
            <section className="mt-4">
              <h2 className="h4">Boleto mensal</h2>
              <p>
                A farmácia ainda não recebe o boleto da contribuição todo mês.
              </p>
              <Link className="btn btn-primary btn-lg" to="/associado/adesao">
                Quero receber o boleto todo mês
              </Link>
            </section>
          )}
          {conta.recebeBoletoMensal && (
            <section className="mt-4">
              <h2 className="h4">Boleto mensal</h2>
              {conta.cancelamentoPedidoEm ? (
                <p>
                  O cancelamento do boleto mensal foi pedido em{' '}
                  {new Date(conta.cancelamentoPedidoEm).toLocaleDateString(
                    'pt-BR',
                  )}
                  . {PRAZO_DA_SEDE} Até lá, a farmácia continua recebendo o
                  boleto.
                </p>
              ) : (
                <>
                  <p>A farmácia recebe o boleto da contribuição todo mês.</p>
                  <Link
                    className="btn btn-outline-secondary btn-lg"
                    to="/associado/cancelamento"
                  >
                    Cancelar o boleto mensal
                  </Link>
                </>
              )}
            </section>
          )}
        </>
      )}
    </>
  );
}
