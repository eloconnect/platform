import type { PedidoSuporte } from '@eloconnect/shared';
import { useEffect, useState } from 'react';
import Card from 'react-bootstrap/Card';
import { Link } from 'react-router';
import { api } from '../../api';
import {
  AvisoSucesso,
  Botao,
  Carregando,
  MensagemErro,
  useTituloPagina,
} from '../../componentes';

type Estado = PedidoSuporte[] | 'carregando' | 'erro';

/**
 * Pedidos de suporte dos associados (RF25), os sem resposta primeiro. A sede
 * responde pelo e-mail que recebeu e marca aqui como respondido, o que fica
 * no histórico de ações (RN26). Os dois perfis da sede atendem.
 */
export function PaginaSuporte() {
  useTituloPagina('Pedidos de suporte');
  const [estado, setEstado] = useState<Estado>('carregando');
  const [aviso, setAviso] = useState('');
  const [erro, setErro] = useState(false);
  const [marcando, setMarcando] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    void api
      .listarSuporte()
      .then((lista) => ativo && setEstado(lista))
      .catch(() => ativo && setEstado('erro'));
    return () => {
      ativo = false;
    };
  }, []);

  async function marcar(pedido: PedidoSuporte) {
    setMarcando(pedido.id);
    setErro(false);
    try {
      const atualizado = await api.marcarSuporteRespondido(pedido.id);
      setEstado((lista) =>
        Array.isArray(lista)
          ? lista.map((p) => (p.id === atualizado.id ? atualizado : p))
          : lista,
      );
      setAviso('Pedido marcado como respondido.');
    } catch {
      setErro(true);
    } finally {
      setMarcando(null);
    }
  }

  return (
    <>
      <h1>Pedidos de suporte</h1>
      <p>
        Responda pelo e-mail que a sede recebeu com o pedido. Depois, marque o
        pedido como respondido.
      </p>
      {aviso && <AvisoSucesso>{aviso}</AvisoSucesso>}
      {erro && (
        <MensagemErro>
          Não foi possível marcar o pedido agora. Tente de novo em alguns
          minutos.
        </MensagemErro>
      )}
      {estado === 'carregando' && <Carregando texto="Carregando..." />}
      {estado === 'erro' && (
        <MensagemErro>
          Não foi possível carregar os pedidos agora. Tente de novo em alguns
          minutos.
        </MensagemErro>
      )}
      {Array.isArray(estado) && estado.length === 0 && (
        <p>Nenhum pedido de suporte.</p>
      )}
      {Array.isArray(estado) &&
        estado.map((pedido) => (
          <Card key={pedido.id} className="mb-3">
            <Card.Body>
              <Card.Title as="h2" className="h5">
                {pedido.assunto}
              </Card.Title>
              <p className="mb-2">
                <Link to={`/admin/associados/${pedido.associado.id}`}>
                  {pedido.associado.razaoSocial}
                </Link>
                , em {new Date(pedido.criadoEm).toLocaleString('pt-BR')}
                {pedido.associado.email && ` (${pedido.associado.email})`}
              </p>
              <p className="texto-com-quebras">{pedido.mensagem}</p>
              {pedido.respondidoEm ? (
                <p className="mb-0">
                  Respondido em{' '}
                  {new Date(pedido.respondidoEm).toLocaleDateString('pt-BR')}
                  {pedido.respondidoPor && ` por ${pedido.respondidoPor}`}.
                </p>
              ) : (
                <Botao
                  disabled={marcando === pedido.id}
                  onClick={() => void marcar(pedido)}
                  aria-label={`Marcar como respondido: ${pedido.assunto}`}
                >
                  Marcar como respondido
                </Botao>
              )}
            </Card.Body>
          </Card>
        ))}
    </>
  );
}
