import type {
  AssociadoDetalhe,
  BoletoHistorico,
  FormatoExportacao,
  HistoricoBoletos,
} from '@eloconnect/shared';
import {
  formatarDia,
  formatarReais,
  textoCompetencia,
  textoMesBoleto,
  textoSituacaoBoleto,
} from '@eloconnect/shared';
import { useEffect, useState, type FormEvent } from 'react';
import Form from 'react-bootstrap/Form';
import Modal from 'react-bootstrap/Modal';
import Table from 'react-bootstrap/Table';
import { api } from '../../api';
import { baixarArquivo } from '../../arquivos';
import { Botao, MensagemErro } from '../../componentes';
import { ehChaveMestre } from '../../sessao';

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'erro' }
  | { tipo: 'ok'; historico: HistoricoBoletos };

/**
 * Histórico de boletos e pagamentos no perfil do associado (US07: RF07), do
 * mês mais novo para o mais antigo, que os dois perfis da sede baixam em PDF
 * ou CSV (US32: RF32). Na demonstração, com o banco simulado, o chave mestre
 * simula o pagamento de um boleto em aberto ou expirado (RF15).
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
      {/* Sem boleto, o arquivo comprova a não contribuição. */}
      {estado.tipo === 'ok' && <ExportarHistorico associado={associado} />}
      {estado.tipo === 'ok' && estado.historico.boletos.length === 0 && (
        <p>Nenhum boleto ainda.</p>
      )}
      {estado.tipo === 'ok' && estado.historico.boletos.length > 0 && (
        <Table responsive className="elo-tabela">
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
                <td>{textoMesBoleto(boleto)}</td>
                <td className="text-nowrap">{formatarReais(boleto.valor)}</td>
                <td className="text-nowrap">
                  {formatarDia(boleto.vencimento)}
                </td>
                <td>{textoSituacaoBoleto(boleto)}</td>
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

/** Botões que baixam o histórico em PDF ou CSV, para comprovar a contribuição. */
function ExportarHistorico({ associado }: { associado: AssociadoDetalhe }) {
  const [baixando, setBaixando] = useState(false);
  const [erro, setErro] = useState(false);

  async function baixar(formato: FormatoExportacao) {
    setBaixando(true);
    setErro(false);
    try {
      baixarArquivo(
        await api.baixarHistoricoBoletos(associado.id, formato),
        `historico-${associado.cnpj}.${formato}`,
      );
    } catch {
      setErro(true);
    } finally {
      setBaixando(false);
    }
  }

  return (
    <div className="mb-3">
      {erro && (
        <MensagemErro>
          Não foi possível baixar o histórico agora. Tente de novo em alguns
          minutos.
        </MensagemErro>
      )}
      <div className="d-flex flex-wrap gap-2">
        <Botao
          variant="outline-primary"
          disabled={baixando}
          onClick={() => void baixar('pdf')}
        >
          Baixar em PDF
        </Botao>
        <Botao
          variant="outline-primary"
          disabled={baixando}
          onClick={() => void baixar('csv')}
        >
          Baixar planilha (CSV)
        </Botao>
      </div>
    </div>
  );
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
