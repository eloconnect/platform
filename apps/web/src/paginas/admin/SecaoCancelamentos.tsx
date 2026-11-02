import type {
  AssociadoDetalhe,
  SolicitacaoCancelamento,
  StatusCancelamento,
} from '@eloconnect/shared';
import { ApiError, formatarDia } from '@eloconnect/shared';
import { useState, type FormEvent } from 'react';
import Form from 'react-bootstrap/Form';
import Modal from 'react-bootstrap/Modal';
import { api } from '../../api';
import { Botao, CampoTexto, MensagemErro } from '../../componentes';
import { ehChaveMestre } from '../../sessao';

const STATUS_CANCELAMENTO: Record<StatusCancelamento, string> = {
  PENDENTE: 'Pendente',
  APROVADA: 'Aprovada',
  RECUSADA: 'Recusada',
  CONFIRMADA_AUTOMATICAMENTE: 'Confirmada sem resposta da sede',
};

type Decisao = 'APROVADA' | 'RECUSADA';

/**
 * Pedidos de cancelamento do associado no perfil (RF07), do mais novo para o
 * mais antigo. O chave mestre aprova ou recusa o pedido pendente; sem
 * resposta até o fim do prazo, ele é confirmado no dia seguinte (US27: RF27,
 * RN18, RN33).
 */
export function SecaoCancelamentos({
  associado,
  aoAtualizar,
}: {
  associado: AssociadoDetalhe;
  aoAtualizar: (atualizado: AssociadoDetalhe, aviso: string) => void;
}) {
  const chaveMestre = ehChaveMestre();
  const [decidindo, setDecidindo] = useState<{
    pedido: SolicitacaoCancelamento;
    decisao: Decisao;
  } | null>(null);

  return (
    <section className="mt-4">
      <h2>Solicitações de cancelamento</h2>
      {associado.cancelamentos.length === 0 ? (
        <p>Nenhuma solicitação.</p>
      ) : (
        <ul>
          {associado.cancelamentos.map((pedido) => (
            <li key={pedido.id} className="mb-3">
              <strong>{STATUS_CANCELAMENTO[pedido.status]}</strong>, pedida em{' '}
              {formatarData(pedido.solicitadaEm)}.
              {pedido.motivo && <div>Motivo: {pedido.motivo}</div>}
              {pedido.status === 'PENDENTE' && (
                <div>
                  A sede pode responder até {formatarDia(pedido.respostaAte)}.
                  Sem resposta, o cancelamento é confirmado no dia seguinte.
                </div>
              )}
              {pedido.decididaEm && (
                <div>
                  {pedido.decididaPor
                    ? `Decidida em ${formatarData(pedido.decididaEm)} por ${pedido.decididaPor.nome}.`
                    : `Confirmada em ${formatarData(pedido.decididaEm)}.`}
                </div>
              )}
              {pedido.observacaoSede && (
                <div>Observação da sede: {pedido.observacaoSede}</div>
              )}
              {chaveMestre && pedido.status === 'PENDENTE' && (
                <div className="d-flex flex-wrap gap-3 mt-2">
                  <Botao
                    variant="danger"
                    onClick={() =>
                      setDecidindo({ pedido, decisao: 'APROVADA' })
                    }
                  >
                    Aprovar o cancelamento
                  </Botao>
                  <Botao
                    variant="outline-primary"
                    onClick={() =>
                      setDecidindo({ pedido, decisao: 'RECUSADA' })
                    }
                  >
                    Recusar o cancelamento
                  </Botao>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <JanelaDecisao
        associado={associado}
        decidindo={decidindo}
        aoFechar={() => setDecidindo(null)}
        aoConcluir={(atualizado, aviso) => {
          setDecidindo(null);
          aoAtualizar(atualizado, aviso);
        }}
      />
    </section>
  );
}

/** Confirmação da decisão, com uma observação que só a sede vê. */
function JanelaDecisao({
  associado,
  decidindo,
  aoFechar,
  aoConcluir,
}: {
  associado: AssociadoDetalhe;
  decidindo: { pedido: SolicitacaoCancelamento; decisao: Decisao } | null;
  aoFechar: () => void;
  aoConcluir: (atualizado: AssociadoDetalhe, aviso: string) => void;
}) {
  const [observacao, setObservacao] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const aprovar = decidindo?.decisao === 'APROVADA';
  const avisoEmail = associado.email
    ? 'O associado vai receber um e-mail com a resposta.'
    : 'O associado não tem e-mail no cadastro, então não recebe aviso.';

  function fechar() {
    setObservacao('');
    setErro(null);
    aoFechar();
  }

  async function confirmar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!decidindo) return;
    setEnviando(true);
    setErro(null);
    try {
      const atualizado = await api.decidirCancelamento(decidindo.pedido.id, {
        decisao: decidindo.decisao,
        ...(observacao.trim() && { observacao: observacao.trim() }),
      });
      setObservacao('');
      aoConcluir(
        atualizado,
        `${aprovar ? 'Cancelamento aprovado.' : 'Pedido de cancelamento recusado.'} ${avisoEmail}`,
      );
    } catch (e) {
      setErro(
        e instanceof ApiError && e.status === 409
          ? e.message
          : 'Não foi possível registrar a decisão agora. Tente de novo em alguns minutos.',
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      show={decidindo !== null}
      onHide={fechar}
      centered
      aria-labelledby="titulo-janela-decisao-cancelamento"
    >
      <Form noValidate onSubmit={(evento) => void confirmar(evento)}>
        <Modal.Header closeButton closeLabel="Fechar">
          <Modal.Title
            as="h2"
            className="h4"
            id="titulo-janela-decisao-cancelamento"
          >
            {aprovar ? 'Aprovar o cancelamento?' : 'Recusar o cancelamento?'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {erro && <MensagemErro>{erro}</MensagemErro>}
          {aprovar ? (
            <>
              <p>
                {associado.razaoSocial} deixa de receber o boleto todo mês e os
                lembretes. Os boletos que já saíram continuam valendo.
              </p>
              <p>
                Se estiver em dia, o associado mantém o acesso a benefícios e
                suporte por mais 30 dias.
              </p>
            </>
          ) : (
            <p>{associado.razaoSocial} continua recebendo o boleto todo mês.</p>
          )}
          <CampoTexto
            rotulo="Observação"
            ajuda="Opcional. Só a sede vê, no perfil e no histórico de ações da sede."
            maxLength={500}
            value={observacao}
            onChange={(evento) => setObservacao(evento.target.value)}
          />
          <p className="mb-0">{avisoEmail}</p>
        </Modal.Body>
        <Modal.Footer>
          <Botao variant="outline-secondary" onClick={fechar}>
            Voltar
          </Botao>
          <Botao
            type="submit"
            variant={aprovar ? 'danger' : 'primary'}
            disabled={enviando}
          >
            {aprovar ? 'Sim, aprovar' : 'Sim, recusar'}
          </Botao>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}
