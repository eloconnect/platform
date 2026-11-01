import type {
  AssociadoDetalhe,
  BoletoHistorico,
  FormaPagamento,
  HistoricoBoletos,
} from '@eloconnect/shared';
import {
  formatarDia,
  formatarReais,
  textoCompetencia,
} from '@eloconnect/shared';
import { useEffect, useState, type FormEvent } from 'react';
import Form from 'react-bootstrap/Form';
import Modal from 'react-bootstrap/Modal';
import Table from 'react-bootstrap/Table';
import { api } from '../../api';
import { Botao, MensagemErro } from '../../componentes';
import { ehChaveMestre } from '../../sessao';

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'erro' }
  | { tipo: 'ok'; historico: HistoricoBoletos };

const TIPOS: Record<BoletoHistorico['tipo'], string> = {
  MENSAL: '',
  AVULSO: ' (avulso)',
  ANUAL: ' (plano anual)',
};

const SITUACOES: Record<
  Exclude<BoletoHistorico['status'], 'EM_ABERTO' | 'PAGO'>,
  string
> = {
  RASCUNHO: 'Em emissão',
  CANCELADO: 'Cancelado',
  EXPIRADO: 'Expirado, sem pagamento',
};

const FORMAS: Record<FormaPagamento, string> = {
  PIX: 'Pix',
  BOLETO: 'boleto',
};

/**
 * Histórico de boletos e pagamentos no perfil do associado (US07: RF07), do
 * mês mais novo para o mais antigo. Na demonstração, com o banco simulado, o
 * chave mestre simula o pagamento de um boleto em aberto ou expirado (RF15).
 */
export function SecaoHistoricoBoletos({
  associado,
  aoPagar,
}: {
  associado: AssociadoDetalhe;
  /** Depois de um pagamento simulado, com o aviso para a sede. */
  aoPagar: (desbloqueado: boolean, aviso: string) => void;
}) {
  const chaveMestre = ehChaveMestre();
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' });
  const [pagando, setPagando] = useState<BoletoHistorico | null>(null);

  useEffect(() => {
    let ativo = true;
    void api
      .listarBoletosAssociado(associado.id)
      .then((historico) => ativo && setEstado({ tipo: 'ok', historico }))
      .catch(() => ativo && setEstado({ tipo: 'erro' }));
    return () => {
      ativo = false;
    };
  }, [associado.id]);

  function recarregar() {
    void api
      .listarBoletosAssociado(associado.id)
      .then((historico) => setEstado({ tipo: 'ok', historico }))
      .catch(() => setEstado({ tipo: 'erro' }));
  }

  const podeSimular =
    chaveMestre && estado.tipo === 'ok' && estado.historico.simulacao;

  return (
    <section className="mt-4">
      <h2>Histórico de boletos e pagamentos</h2>
      {estado.tipo === 'carregando' && (
        <p role="status">Carregando os boletos...</p>
      )}
      {estado.tipo === 'erro' && (
        <MensagemErro>
          Não foi possível carregar os boletos agora. Tente de novo em alguns
          minutos.
        </MensagemErro>
      )}
      {estado.tipo === 'ok' && estado.historico.boletos.length === 0 && (
        <p>Nenhum boleto ainda.</p>
      )}
      {estado.tipo === 'ok' && estado.historico.boletos.length > 0 && (
        <Table responsive>
          <thead>
            <tr>
              <th scope="col">Mês</th>
              <th scope="col">Valor</th>
              <th scope="col">Vencimento</th>
              <th scope="col">Situação</th>
              {podeSimular && <th scope="col">Demonstração</th>}
            </tr>
          </thead>
          <tbody>
            {estado.historico.boletos.map((boleto) => (
              <tr key={boleto.id}>
                <td>
                  {textoCompetencia(boleto.competencia)}
                  {TIPOS[boleto.tipo]}
                </td>
                <td className="text-nowrap">{formatarReais(boleto.valor)}</td>
                <td className="text-nowrap">
                  {formatarDia(boleto.vencimento)}
                </td>
                <td>{textoSituacao(boleto)}</td>
                {podeSimular && (
                  <td>
                    {(boleto.status === 'EM_ABERTO' ||
                      boleto.status === 'EXPIRADO') && (
                      <Botao
                        size="sm"
                        variant="outline-primary"
                        aria-label={`Simular o pagamento do boleto de ${textoCompetencia(boleto.competencia)}`}
                        onClick={() => setPagando(boleto)}
                      >
                        Simular pagamento
                      </Botao>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <JanelaSimularPagamento
        boleto={pagando}
        aoFechar={() => setPagando(null)}
        aoConcluir={(desbloqueado, aviso) => {
          setPagando(null);
          recarregar();
          aoPagar(desbloqueado, aviso);
        }}
      />
    </section>
  );
}

function textoSituacao(boleto: BoletoHistorico): string {
  if (boleto.status === 'EM_ABERTO') {
    return boleto.vencido ? 'Vencido' : 'Em aberto';
  }
  if (boleto.status === 'PAGO') {
    // A data do pagamento no horário de Mato Grosso, onde fica a sede.
    const quando = boleto.pagoEm
      ? ` em ${new Date(boleto.pagoEm).toLocaleDateString('pt-BR', { timeZone: 'America/Cuiaba' })}`
      : '';
    const forma = boleto.formaPagamento
      ? `, com ${FORMAS[boleto.formaPagamento]}`
      : '';
    return `Pago${quando}${forma}`;
  }
  return SITUACOES[boleto.status];
}

/** Confirmação do pagamento simulado, com a forma de pagamento. */
function JanelaSimularPagamento({
  boleto,
  aoFechar,
  aoConcluir,
}: {
  boleto: BoletoHistorico | null;
  aoFechar: () => void;
  aoConcluir: (desbloqueado: boolean, aviso: string) => void;
}) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(false);
  const mes = boleto ? textoCompetencia(boleto.competencia) : '';

  function fechar() {
    setErro(false);
    aoFechar();
  }

  async function confirmar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!boleto) return;
    const formaPagamento =
      new FormData(evento.currentTarget).get('formaPagamento') === 'BOLETO'
        ? 'BOLETO'
        : 'PIX';
    setEnviando(true);
    setErro(false);
    try {
      const resultado = await api.simularPagamento(boleto.id, {
        formaPagamento,
      });
      aoConcluir(
        resultado.desbloqueado,
        resultado.jaEstavaPago
          ? `O boleto de ${mes} já estava pago.`
          : `Pagamento do boleto de ${mes} simulado.${resultado.desbloqueado ? ' O acesso a benefícios e suporte foi liberado.' : ''}`,
      );
    } catch {
      setErro(true);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      show={boleto !== null}
      onHide={fechar}
      centered
      aria-labelledby="titulo-janela-simular-pagamento"
    >
      <Form onSubmit={(evento) => void confirmar(evento)}>
        <Modal.Header closeButton closeLabel="Fechar">
          <Modal.Title
            as="h2"
            className="h4"
            id="titulo-janela-simular-pagamento"
          >
            Simular o pagamento do boleto de {mes}?
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {erro && (
            <MensagemErro>
              Não foi possível simular o pagamento agora. Tente de novo em
              alguns minutos.
            </MensagemErro>
          )}
          <p>
            Só para a demonstração: o sistema age como se o banco tivesse
            confirmado o pagamento, e a ação fica no histórico de ações da sede.
          </p>
          <fieldset>
            <legend className="fs-6 fw-semibold">Forma de pagamento</legend>
            <Form.Check
              type="radio"
              id="forma-pagamento-pix"
              name="formaPagamento"
              value="PIX"
              label="Pix"
              defaultChecked
            />
            <Form.Check
              type="radio"
              id="forma-pagamento-boleto"
              name="formaPagamento"
              value="BOLETO"
              label="Boleto"
            />
          </fieldset>
        </Modal.Body>
        <Modal.Footer>
          <Botao variant="outline-secondary" onClick={fechar}>
            Cancelar
          </Botao>
          <Botao type="submit" disabled={enviando}>
            Simular o pagamento
          </Botao>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
