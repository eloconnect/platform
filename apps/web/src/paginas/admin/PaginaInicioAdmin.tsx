import type { PedidoQuitacaoSede } from '@eloconnect/shared';
import { formatarReais } from '@eloconnect/shared';
import { useEffect, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import { Link } from 'react-router';
import { api } from '../../api';
import { MensagemErro, useTituloPagina } from '../../componentes';
import { ehChaveMestre } from '../../sessao';

/**
 * Início do painel da sede. O chave mestre, que decide os cancelamentos e os
 * boletos dos meses em aberto, vê os pedidos que esperam resposta (US27:
 * RF27, RN30, RN33).
 */
export function PaginaInicioAdmin() {
  useTituloPagina('Painel da sede');
  const chaveMestre = ehChaveMestre();
  const [pendentes, setPendentes] = useState<number | 'erro' | null>(null);
  const [quitacoes, setQuitacoes] = useState<
    PedidoQuitacaoSede[] | 'erro' | null
  >(null);

  useEffect(() => {
    let ativo = true;
    if (chaveMestre) {
      void api
        .listarAssociados({ status: 'CANCELAMENTO_SOLICITADO' })
        .then((lista) => ativo && setPendentes(lista.total))
        .catch(() => ativo && setPendentes('erro'));
      void api
        .listarPedidosQuitacao()
        .then((lista) => ativo && setQuitacoes(lista))
        .catch(() => ativo && setQuitacoes('erro'));
    }
    return () => {
      ativo = false;
    };
  }, [chaveMestre]);

  return (
    <>
      <h1>Painel da sede</h1>
      {pendentes === 'erro' && (
        <MensagemErro>
          Não foi possível conferir os pedidos de cancelamento agora. Tente de
          novo em alguns minutos.
        </MensagemErro>
      )}
      {typeof pendentes === 'number' && pendentes > 0 && (
        <Alert variant="warning">
          <Alert.Heading as="h2" className="h5">
            {pendentes === 1
              ? '1 pedido de cancelamento espera resposta'
              : `${pendentes} pedidos de cancelamento esperam resposta`}
          </Alert.Heading>
          <p>Sem resposta da sede em 15 dias, o cancelamento é confirmado.</p>
          <Link
            className="btn btn-primary btn-lg"
            to="/admin/associados?status=CANCELAMENTO_SOLICITADO"
          >
            Ver os pedidos
          </Link>
        </Alert>
      )}
      {quitacoes === 'erro' && (
        <MensagemErro>
          Não foi possível conferir os pedidos do boleto dos meses em aberto
          agora. Tente de novo em alguns minutos.
        </MensagemErro>
      )}
      {Array.isArray(quitacoes) && quitacoes.length > 0 && (
        <Alert variant="warning">
          <Alert.Heading as="h2" className="h5">
            {quitacoes.length === 1
              ? '1 pedido do boleto dos meses em aberto espera resposta'
              : `${quitacoes.length} pedidos do boleto dos meses em aberto esperam resposta`}
          </Alert.Heading>
          <ul className="mb-0">
            {quitacoes.map((pedido) => (
              <li key={pedido.id}>
                <Link to={`/admin/associados/${pedido.associadoId}`}>
                  {pedido.razaoSocial}
                </Link>
                : {formatarReais(pedido.total)}
              </li>
            ))}
          </ul>
        </Alert>
      )}
      <p>Em construção.</p>
    </>
  );
}
