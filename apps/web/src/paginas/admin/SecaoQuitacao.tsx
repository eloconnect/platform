import type { AssociadoDetalhe, PedidoQuitacaoSede } from '@eloconnect/shared';
import { ApiError, formatarReais, textoCompetencia } from '@eloconnect/shared';
import { useEffect, useState, type FormEvent } from 'react';
import Form from 'react-bootstrap/Form';
import Modal from 'react-bootstrap/Modal';
import { api } from '../../api';
import { Botao, CampoTexto, MensagemErro } from '../../componentes';

type Decisao = 'APROVADO' | 'RECUSADO';

type Estado = PedidoQuitacaoSede[] | 'carregando' | 'erro';

/**
 * Pedido do boleto único dos meses em aberto, no perfil, só para o chave
 * mestre (RN30, RN33). Ele vê os meses e o total, e aprova ou recusa.
 * Aprovado, o boleto sai na hora e vai por e-mail.
 */
export function SecaoQuitacao({
  associado,
  aoDecidir,
}: {
  associado: AssociadoDetalhe;
  aoDecidir: (aviso: string) => void;
}) {
  const [estado, setEstado] = useState<Estado>('carregando');
  const [decidindo, setDecidindo] = useState<{
    pedido: PedidoQuitacaoSede;
    decisao: Decisao;
  } | null>(null);

  useEffect(() => {
    let ativo = true;
    void api
      .listarPedidosQuitacao(associado.id)
      .then((lista) => ativo && setEstado(lista))
      .catch(() => ativo && setEstado('erro'));
    return () => {
      ativo = false;
    };
  }, [associado.id]);

  if (estado === 'carregando' || (Array.isArray(estado) && !estado.length)) {
    return null;
  }
  return (
    <section className="mt-4">
      <h2>Boleto dos meses em aberto</h2>
      {estado === 'erro' ? (
        <MensagemErro>
          Não foi possível conferir o pedido do boleto dos meses em aberto
          agora. Tente de novo em alguns minutos.
        </MensagemErro>
      ) : (
        estado.map((pedido) => (
          <div key={pedido.id}>
            <p>
              Pedido em{' '}
              {new Date(pedido.solicitadoEm).toLocaleDateString('pt-BR')}. Os
              meses em aberto, sem juros, num boleto só:
            </p>
            <ul>
              {pedido.meses.map((mes) => (
                <li key={`${mes.competencia.ano}-${mes.competencia.mes}`}>
                  {textoCompetencia(mes.competencia)}:{' '}
                  {formatarReais(mes.valor)}
                </li>
              ))}
            </ul>
            <p>
              <strong>Total: {formatarReais(pedido.total)}</strong>
            </p>
            <div className="d-flex flex-wrap gap-3">
              <Botao
                onClick={() => setDecidindo({ pedido, decisao: 'APROVADO' })}
              >
                Aprovar e gerar o boleto
              </Botao>
              <Botao
                variant="outline-primary"
                onClick={() => setDecidindo({ pedido, decisao: 'RECUSADO' })}
              >
                Recusar o pedido
              </Botao>
            </div>
          </div>
        ))
      )}
      <JanelaDecisao
        associado={associado}
        decidindo={decidindo}
        aoFechar={() => setDecidindo(null)}
        aoConcluir={(aviso) => {
          setDecidindo(null);
          setEstado([]);
          aoDecidir(aviso);
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
  decidindo: { pedido: PedidoQuitacaoSede; decisao: Decisao } | null;
  aoFechar: () => void;
  aoConcluir: (aviso: string) => void;
}) {
  const [observacao, setObservacao] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const aprovar = decidindo?.decisao === 'APROVADO';

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
      await api.decidirQuitacao(decidindo.pedido.id, {
        decisao: decidindo.decisao,
        ...(observacao.trim() && { observacao: observacao.trim() }),
      });
      setObservacao('');
      aoConcluir(
        aprovar
          ? `Boleto dos meses em aberto gerado. ${associado.email ? 'Ele vai por e-mail e' : 'Ele'} aparece em "Meus boletos" para o associado.`
          : `Pedido recusado. ${associado.email ? 'O associado vai receber um e-mail.' : 'O associado não tem e-mail no cadastro, então não recebe aviso.'}`,
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
      aria-labelledby="titulo-janela-decisao-quitacao"
    >
      <Form noValidate onSubmit={(evento) => void confirmar(evento)}>
        <Modal.Header closeButton closeLabel="Fechar">
          <Modal.Title
            as="h2"
            className="h4"
            id="titulo-janela-decisao-quitacao"
          >
            {aprovar
              ? 'Gerar o boleto dos meses em aberto?'
              : 'Recusar o pedido?'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {erro && <MensagemErro>{erro}</MensagemErro>}
          {aprovar && decidindo ? (
            <p>
              O boleto de {formatarReais(decidindo.pedido.total)} sai na hora,
              vence em 10 dias e vai para {associado.razaoSocial}. Pago, a
              farmácia volta a ficar em dia.
            </p>
          ) : (
            <p>Nenhum boleto é gerado.</p>
          )}
          <CampoTexto
            rotulo="Observação"
            ajuda="Opcional. Só a sede vê, no histórico de ações da sede."
            maxLength={500}
            value={observacao}
            onChange={(evento) => setObservacao(evento.target.value)}
          />
        </Modal.Body>
        <Modal.Footer>
          <Botao variant="outline-secondary" onClick={fechar}>
            Voltar
          </Botao>
          <Botao type="submit" disabled={enviando}>
            {aprovar ? 'Sim, gerar o boleto' : 'Sim, recusar'}
          </Botao>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
