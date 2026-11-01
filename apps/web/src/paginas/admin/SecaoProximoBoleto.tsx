import type { AssociadoDetalhe, ProximoBoleto } from '@eloconnect/shared';
import {
  ApiError,
  formatarReais,
  lerValorEmReais,
  textoCompetencia,
} from '@eloconnect/shared';
import { useState, type FormEvent } from 'react';
import Form from 'react-bootstrap/Form';
import Modal from 'react-bootstrap/Modal';
import { api } from '../../api';
import { Botao, CampoTexto, MensagemErro } from '../../componentes';
import { ehChaveMestre } from '../../sessao';

/**
 * Boleto mensal do mês seguinte (US11: RF11, RN04). O chave mestre muda o
 * valor só desse boleto ou volta ao valor normal, e o associado recebe um
 * e-mail na hora. Não aparece para quem não recebe o boleto mensal.
 */
export function SecaoProximoBoleto({
  associado,
  aoAtualizar,
}: {
  associado: AssociadoDetalhe;
  aoAtualizar: (proximoBoleto: ProximoBoleto, aviso: string) => void;
}) {
  // O perfil básico da sede só consulta (RN33).
  const chaveMestre = ehChaveMestre();
  const [janela, setJanela] = useState<'mudar' | 'normal' | null>(null);
  const proximo = associado.proximoBoleto;
  if (!proximo || !associado.contribuicaoAtiva || associado.inativadoEm) {
    return null;
  }
  const mes = textoCompetencia(proximo.competencia);

  function concluir(atualizado: ProximoBoleto, feito: string) {
    setJanela(null);
    aoAtualizar(
      atualizado,
      `${feito} ${
        associado.email
          ? 'O associado vai receber um e-mail com o aviso.'
          : 'O associado não tem e-mail no cadastro, então não recebe aviso.'
      }`,
    );
  }

  return (
    <section className="mt-4">
      <h2>Próximo boleto</h2>
      {proximo.valorNormal === null ? (
        <p>
          O valor da contribuição ainda não foi cadastrado. Cadastre o valor em
          &quot;Valor da contribuição&quot;.
        </p>
      ) : (
        <>
          <p>{textoProximo(proximo, proximo.valorNormal, mes)}</p>
          {chaveMestre && (
            <div className="d-flex flex-wrap gap-3">
              <Botao
                variant="outline-primary"
                onClick={() => setJanela('mudar')}
              >
                Mudar o valor
              </Botao>
              {proximo.valorEditado && (
                <Botao
                  variant="outline-primary"
                  onClick={() => setJanela('normal')}
                >
                  Voltar ao valor normal
                </Botao>
              )}
            </div>
          )}
          <JanelaMudarValor
            associado={associado}
            proximo={proximo}
            valorNormal={proximo.valorNormal}
            mes={mes}
            aberta={janela === 'mudar'}
            aoFechar={() => setJanela(null)}
            aoConcluir={(atualizado) =>
              concluir(atualizado, `Valor do boleto de ${mes} mudado.`)
            }
          />
          <JanelaValorNormal
            associado={associado}
            valorNormal={proximo.valorNormal}
            mes={mes}
            aberta={janela === 'normal'}
            aoFechar={() => setJanela(null)}
            aoConcluir={(atualizado) =>
              concluir(atualizado, `O boleto de ${mes} voltou ao valor normal.`)
            }
          />
        </>
      )}
    </section>
  );
}

function textoProximo(
  proximo: ProximoBoleto,
  valorNormal: string,
  mes: string,
): string {
  if (proximo.valorEditado) {
    return `Boleto de ${mes}: ${formatarReais(proximo.valorEditado)}, valor mudado pela sede só para este mês. O valor normal é ${formatarReais(valorNormal)}.`;
  }
  return `Boleto de ${mes}: ${formatarReais(valorNormal)}, o valor normal da contribuição.`;
}

/** Quem recebe o aviso, para a sede saber antes de confirmar (RN04). */
function textoAviso(associado: AssociadoDetalhe): string {
  return associado.email
    ? `${associado.razaoSocial} recebe agora um e-mail avisando da mudança.`
    : 'Este associado não tem e-mail no cadastro, então não recebe o aviso.';
}

function JanelaMudarValor({
  associado,
  proximo,
  valorNormal,
  mes,
  aberta,
  aoFechar,
  aoConcluir,
}: {
  associado: AssociadoDetalhe;
  proximo: ProximoBoleto;
  valorNormal: string;
  mes: string;
  aberta: boolean;
  aoFechar: () => void;
  aoConcluir: (atualizado: ProximoBoleto) => void;
}) {
  const [texto, setTexto] = useState('');
  const [erroCampo, setErroCampo] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(false);

  function fechar() {
    setTexto('');
    setErroCampo(undefined);
    setErro(false);
    aoFechar();
  }

  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const valor = lerValorEmReais(texto);
    const atual = proximo.valorEditado ?? valorNormal;
    if (!valor) {
      setErroCampo('Digite o valor em reais, por exemplo 100,00.');
    } else if (Number(valor) <= 0) {
      setErroCampo('O valor precisa ser maior que zero.');
    } else if (Number(valor) === Number(atual)) {
      setErroCampo('O boleto já está com este valor.');
    } else if (Number(valor) === Number(valorNormal)) {
      setErroCampo(
        'Este é o valor normal da contribuição. Para voltar a ele, use "Voltar ao valor normal".',
      );
    } else {
      setErroCampo(undefined);
      setErro(false);
      setEnviando(true);
      try {
        const atualizado = await api.editarProximoBoleto(associado.id, {
          valor,
        });
        setTexto('');
        aoConcluir(atualizado);
      } catch (e) {
        if (e instanceof ApiError && e.campo === 'valor') {
          setErroCampo(e.message);
        } else {
          setErro(true);
        }
      } finally {
        setEnviando(false);
      }
    }
  }

  return (
    <Modal
      show={aberta}
      onHide={fechar}
      centered
      aria-labelledby="titulo-janela-proximo-boleto"
    >
      <Form noValidate onSubmit={(evento) => void salvar(evento)}>
        <Modal.Header closeButton closeLabel="Fechar">
          <Modal.Title as="h2" className="h4" id="titulo-janela-proximo-boleto">
            Mudar o valor do boleto de {mes}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {erro && (
            <MensagemErro>
              Não foi possível mudar o valor agora. Tente de novo em alguns
              minutos.
            </MensagemErro>
          )}
          <p>
            Vale só para o boleto de {mes}. Os boletos dos outros meses seguem o
            valor normal, de {formatarReais(valorNormal)}.
          </p>
          <CampoTexto
            rotulo="Novo valor do boleto"
            name="valor"
            inputMode="decimal"
            autoComplete="off"
            ajuda="Em reais, por exemplo 100,00."
            obrigatorio
            erro={erroCampo}
            value={texto}
            onChange={(evento) => setTexto(evento.target.value)}
          />
          <p className="mb-0">{textoAviso(associado)}</p>
        </Modal.Body>
        <Modal.Footer>
          <Botao variant="outline-secondary" onClick={fechar}>
            Cancelar
          </Botao>
          <Botao type="submit" disabled={enviando}>
            Salvar o novo valor
          </Botao>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

function JanelaValorNormal({
  associado,
  valorNormal,
  mes,
  aberta,
  aoFechar,
  aoConcluir,
}: {
  associado: AssociadoDetalhe;
  valorNormal: string;
  mes: string;
  aberta: boolean;
  aoFechar: () => void;
  aoConcluir: (atualizado: ProximoBoleto) => void;
}) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(false);

  function fechar() {
    setErro(false);
    aoFechar();
  }

  async function confirmar() {
    setEnviando(true);
    setErro(false);
    try {
      aoConcluir(await api.voltarAoValorNormal(associado.id));
    } catch {
      setErro(true);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      show={aberta}
      onHide={fechar}
      centered
      aria-labelledby="titulo-janela-valor-normal"
    >
      <Modal.Header closeButton closeLabel="Fechar">
        <Modal.Title as="h2" className="h4" id="titulo-janela-valor-normal">
          Voltar ao valor normal?
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {erro && (
          <MensagemErro>
            Não foi possível voltar ao valor normal agora. Tente de novo em
            alguns minutos.
          </MensagemErro>
        )}
        <p>
          O boleto de {mes} volta para {formatarReais(valorNormal)}, o valor
          normal da contribuição.
        </p>
        <p className="mb-0">{textoAviso(associado)}</p>
      </Modal.Body>
      <Modal.Footer>
        <Botao variant="outline-secondary" onClick={fechar}>
          Cancelar
        </Botao>
        <Botao disabled={enviando} onClick={() => void confirmar()}>
          Sim, voltar ao valor normal
        </Botao>
      </Modal.Footer>
    </Modal>
  );
}
