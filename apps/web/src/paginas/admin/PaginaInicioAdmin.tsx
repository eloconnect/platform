import type { PedidoQuitacaoSede } from '@eloconnect/shared';
import { formatarReais } from '@eloconnect/shared';
import { useEffect, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import { Link } from 'react-router';
import { api } from '../../api';
import { MensagemErro, useTituloPagina } from '../../componentes';
import { ehChaveMestre } from '../../sessao';

/**
 * Início do painel da sede. Os dois perfis veem os pedidos de suporte sem
 * resposta (RF25). O chave mestre, que decide os cancelamentos e os boletos
 * dos meses em aberto, também vê esses pedidos (US27: RF27, RN30, RN33).
 */
export function PaginaInicioAdmin() {
  useTituloPagina('Painel da sede');
  const chaveMestre = ehChaveMestre();
  const [pendentes, setPendentes] = useState<number | 'erro' | null>(null);
  const [suporte, setSuporte] = useState<number | 'erro' | null>(null);
  const [quitacoes, setQuitacoes] = useState<
    PedidoQuitacaoSede[] | 'erro' | null
  >(null);

  useEffect(() => {
    let ativo = true;
    // Os dois perfis atendem o suporte (RF25).
    void api
      .listarSuporte()
      .then(
        (lista) =>
          ativo && setSuporte(lista.filter((p) => !p.respondidoEm).length),
      )
      .catch(() => ativo && setSuporte('erro'));
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
      {suporte === 'erro' && (
        <MensagemErro>
          Não foi possível conferir os pedidos de suporte agora. Tente de novo
          em alguns minutos.
        </MensagemErro>
      )}
      {typeof suporte === 'number' && suporte > 0 && (
        <Alert variant="warning">
          <Alert.Heading as="h2" className="h5">
            {suporte === 1
              ? '1 pedido de suporte espera resposta'
              : `${suporte} pedidos de suporte esperam resposta`}
          </Alert.Heading>
          <Link className="btn btn-primary btn-lg" to="/admin/suporte">
            Ver os pedidos
          </Link>
        </Alert>
      )}
      <p>Em construção.</p>
    </>
  );
}
