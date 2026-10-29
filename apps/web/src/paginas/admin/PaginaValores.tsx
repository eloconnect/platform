import type { PainelValores, ValorContribuicao } from '@eloconnect/shared';
import {
  ApiError,
  calcularValorAnual,
  competenciaDoNovoValor,
  formatarReais,
  lerValorEmReais,
  textoCompetencia,
} from '@eloconnect/shared';
import { useEffect, useState, type FormEvent } from 'react';
import Form from 'react-bootstrap/Form';
import Modal from 'react-bootstrap/Modal';
import Table from 'react-bootstrap/Table';
import { api } from '../../api';
import {
  AvisoSucesso,
  Botao,
  CampoTexto,
  MensagemErro,
  useTituloPagina,
} from '../../componentes';

/** Novo valor esperando a confirmação, com o mês em que passa a valer. */
interface Confirmacao {
  valor: string;
  mesInicial: string;
}

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'erro' }
  | { tipo: 'ok'; painel: PainelValores };

/**
 * Painel de valores (US18 a US20): valor atual, alteração com confirmação e
 * histórico. Só o chave mestre usa (RN20, RN33).
 */
export function PaginaValores() {
  useTituloPagina('Valor da contribuição');
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' });
  const [texto, setTexto] = useState('');
  const [erroCampo, setErroCampo] = useState<string>();
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null);
  const [aviso, setAviso] = useState<string>();

  useEffect(() => {
    let ativo = true;
    void api
      .painelValores()
      .then((painel) => ativo && setEstado({ tipo: 'ok', painel }))
      .catch(() => ativo && setEstado({ tipo: 'erro' }));
    return () => {
      ativo = false;
    };
  }, []);

  if (estado.tipo !== 'ok') {
    return (
      <>
        <h1>Valor da contribuição</h1>
        {estado.tipo === 'carregando' ? (
          <p role="status">Carregando os valores...</p>
        ) : (
          <MensagemErro>
            Não foi possível carregar os valores agora. Tente de novo em alguns
            minutos.
          </MensagemErro>
        )}
      </>
    );
  }

  const { painel } = estado;
  const { atual } = painel;
  const valorLido = lerValorEmReais(texto);

  function continuar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setAviso(undefined);
    if (!valorLido) {
      setErroCampo('Digite o valor em reais, por exemplo 130,00.');
    } else if (Number(valorLido) <= 0) {
      setErroCampo('O valor precisa ser maior que zero.');
    } else if (atual && Number(atual.valorMensal) === Number(valorLido)) {
      setErroCampo('Este já é o valor atual.');
    } else {
      setErroCampo(undefined);
      setConfirmacao({
        valor: valorLido,
        mesInicial: textoCompetencia(competenciaDoNovoValor(new Date())),
      });
    }
  }

  function concluir(atualizado: PainelValores) {
    setEstado({ tipo: 'ok', painel: atualizado });
    setConfirmacao(null);
    setTexto('');
    setAviso(
      `O novo valor foi salvo. ${textoAvisados(atualizado.associadosAvisados)}`,
    );
  }

  return (
    <>
      <h1>Valor da contribuição</h1>
      {aviso && <AvisoSucesso>{aviso}</AvisoSucesso>}

      <section aria-labelledby="titulo-atual" className="mb-5">
        <h2 id="titulo-atual">Valor atual</h2>
        {atual ? (
          <>
            <p className="fs-3 mb-2">
              {formatarReais(atual.valorMensal)} por mês
            </p>
            <p className="mb-2">
              Plano anual à vista: {formatarReais(atual.valorAnual)}, com 20% de
              desconto.
            </p>
            <p className="text-body-secondary">
              Alterado em {formatarData(atual.alteradoEm)} por{' '}
              {atual.alteradoPor.nome}. Vale a partir do boleto de{' '}
              {mesInicial(atual)}.
            </p>
          </>
        ) : (
          <p>Nenhum valor cadastrado ainda.</p>
        )}
      </section>

      <section aria-labelledby="titulo-alterar" className="mb-5">
        <h2 id="titulo-alterar">Alterar o valor</h2>
        <Form noValidate onSubmit={continuar}>
          <CampoTexto
            rotulo="Novo valor mensal"
            name="valorMensal"
            inputMode="decimal"
            autoComplete="off"
            value={texto}
            onChange={(evento) => setTexto(evento.target.value)}
            ajuda="Em reais, por exemplo 130,00. O plano anual é calculado sozinho: 12 meses com 20% de desconto."
            erro={erroCampo}
          />
          {/* Sempre na tela, para o leitor de tela anunciar quando muda. */}
          <p aria-live="polite">
            {valorLido &&
              Number(valorLido) > 0 &&
              `Plano anual à vista com este valor: ${formatarReais(calcularValorAnual(valorLido))}.`}
          </p>
          <Botao type="submit">Continuar</Botao>
        </Form>
      </section>

      <section aria-labelledby="titulo-historico">
        <h2 id="titulo-historico">Histórico de alterações</h2>
        {painel.historico.length === 0 ? (
          <p>Nenhuma alteração ainda.</p>
        ) : (
          <Table responsive>
            <thead>
              <tr>
                <th scope="col">Data</th>
                <th scope="col">Quem alterou</th>
                <th scope="col">Valor anterior</th>
                <th scope="col">Novo valor</th>
                <th scope="col">Plano anual</th>
                <th scope="col">Vale a partir do boleto de</th>
              </tr>
            </thead>
            <tbody>
              {painel.historico.map((valor, i) => {
                const anterior = painel.historico[i + 1];
                return (
                  <tr key={valor.id}>
                    <td className="text-nowrap">
                      {formatarData(valor.alteradoEm)}
                    </td>
                    <td>{valor.alteradoPor.nome}</td>
                    <td className="text-nowrap">
                      {anterior ? formatarReais(anterior.valorMensal) : '—'}
                    </td>
                    <td className="text-nowrap">
                      {formatarReais(valor.valorMensal)}
                    </td>
                    <td className="text-nowrap">
                      {formatarReais(valor.valorAnual)}
                    </td>
                    <td>{mesInicial(valor)}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </section>

      <JanelaConfirmacao
        painel={painel}
        confirmacao={confirmacao}
        aoFechar={() => setConfirmacao(null)}
        aoConcluir={concluir}
        aoRecusar={() => {
          setConfirmacao(null);
          setErroCampo(
            'Confira o valor: ele precisa ser maior que zero e diferente do atual.',
          );
        }}
      />
    </>
  );
}

/**
 * Confirmação explícita antes de salvar (US18): mostra o valor de antes e o
 * novo, quando passa a valer e quantos associados recebem o aviso (RN15).
 */
function JanelaConfirmacao({
  painel,
  confirmacao,
  aoFechar,
  aoConcluir,
  aoRecusar,
}: {
  painel: PainelValores;
  confirmacao: Confirmacao | null;
  aoFechar: () => void;
  aoConcluir: (atualizado: PainelValores) => void;
  /** A API recusou o valor (ex.: outra pessoa salvou o mesmo valor antes). */
  aoRecusar: () => void;
}) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(false);
  const { atual } = painel;

  function fechar() {
    setErro(false);
    aoFechar();
  }

  async function confirmar(valorMensal: string) {
    setEnviando(true);
    setErro(false);
    try {
      aoConcluir(await api.alterarValor({ valorMensal }));
    } catch (e) {
      if (e instanceof ApiError && e.campo === 'valorMensal') {
        aoRecusar();
      } else {
        setErro(true);
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      show={confirmacao !== null}
      onHide={fechar}
      centered
      aria-labelledby="titulo-janela-valor"
    >
      <Modal.Header closeButton closeLabel="Fechar">
        <Modal.Title as="h2" className="h4" id="titulo-janela-valor">
          Confirmar o novo valor?
        </Modal.Title>
      </Modal.Header>
      {confirmacao && (
        <Modal.Body>
          {erro && (
            <MensagemErro>
              Não foi possível salvar o valor agora. Tente de novo em alguns
              minutos.
            </MensagemErro>
          )}
          <ul className="list-unstyled">
            <li>
              Valor mensal:{' '}
              {atual && <>{formatarReais(atual.valorMensal)} → </>}
              <strong>{formatarReais(confirmacao.valor)}</strong>
            </li>
            <li>
              Plano anual à vista:{' '}
              {atual && <>{formatarReais(atual.valorAnual)} → </>}
              <strong>
                {formatarReais(calcularValorAnual(confirmacao.valor))}
              </strong>
            </li>
          </ul>
          <p>
            Vale a partir do boleto de {confirmacao.mesInicial}. Os boletos já
            enviados não mudam.
          </p>
          <p className="mb-0">{textoAvisoAgora(painel.associadosAvisados)}</p>
        </Modal.Body>
      )}
      <Modal.Footer>
        <Botao variant="outline-secondary" onClick={fechar}>
          Cancelar
        </Botao>
        <Botao
          disabled={enviando}
          onClick={() => confirmacao && void confirmar(confirmacao.valor)}
        >
          Sim, alterar o valor
        </Botao>
      </Modal.Footer>
    </Modal>
  );
}

function mesInicial(valor: ValorContribuicao): string {
  return textoCompetencia(competenciaDoNovoValor(new Date(valor.alteradoEm)));
}

/** Data no horário de Mato Grosso, onde fica a sede. */
function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    timeZone: 'America/Cuiaba',
  });
}

function textoAvisoAgora(avisados: number): string {
  if (avisados === 0) {
    return 'Nenhum associado recebe o boleto mensal agora, então ninguém recebe aviso.';
  }
  if (avisados === 1) {
    return 'O associado que recebe o boleto mensal vai receber agora um e-mail com o aviso.';
  }
  return `Os ${avisados} associados que recebem o boleto mensal vão receber agora um e-mail com o aviso.`;
}

function textoAvisados(avisados: number): string {
  if (avisados === 0) return 'Nenhum associado recebe o boleto mensal agora.';
  if (avisados === 1) return 'O aviso por e-mail está indo para 1 associado.';
  return `O aviso por e-mail está indo para ${avisados} associados.`;
}
