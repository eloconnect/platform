import type { AssociadoDetalhe } from '@eloconnect/shared';
import { useState, type FormEvent } from 'react';
import Form from 'react-bootstrap/Form';
import Modal from 'react-bootstrap/Modal';
import { api } from '../../api';
import { Botao, CampoTexto, MensagemErro } from '../../componentes';

/**
 * Confirmação antes de interromper a cobrança recorrente (US35: RF38, RN25),
 * com o motivo, que fica só no log de auditoria.
 */
export function JanelaInterromperCobranca({
  associado,
  aberta,
  aoFechar,
  aoConcluir,
}: {
  associado: AssociadoDetalhe;
  aberta: boolean;
  aoFechar: () => void;
  aoConcluir: (atualizado: AssociadoDetalhe, aviso: string) => void;
}) {
  const [motivo, setMotivo] = useState('');
  const [erroMotivo, setErroMotivo] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(false);

  function fechar() {
    setMotivo('');
    setErroMotivo(undefined);
    setErro(false);
    aoFechar();
  }

  async function confirmar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!motivo.trim()) {
      setErroMotivo('Escreva o motivo.');
      return;
    }
    setErroMotivo(undefined);
    setEnviando(true);
    setErro(false);
    try {
      const atualizado = await api.interromperCobranca(associado.id, {
        motivo: motivo.trim(),
      });
      setMotivo('');
      aoConcluir(
        atualizado,
        `Cobrança mensal interrompida. ${
          associado.email
            ? 'O associado vai receber um e-mail com o aviso.'
            : 'O associado não tem e-mail no cadastro, então não recebe aviso.'
        }`,
      );
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
      aria-labelledby="titulo-janela-interromper"
    >
      <Form noValidate onSubmit={(evento) => void confirmar(evento)}>
        <Modal.Header closeButton closeLabel="Fechar">
          <Modal.Title as="h2" className="h4" id="titulo-janela-interromper">
            Interromper a cobrança mensal?
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {erro && (
            <MensagemErro>
              Não foi possível interromper a cobrança agora. Tente de novo em
              alguns minutos.
            </MensagemErro>
          )}
          <p>
            {associado.razaoSocial} deixa de receber o boleto todo mês e os
            lembretes. Os boletos que já saíram continuam valendo.
          </p>
          <p>
            Se estiver em dia, o associado mantém o acesso a benefícios e
            suporte por mais 30 dias.
          </p>
          <CampoTexto
            rotulo="Motivo"
            ajuda="Fica registrado no histórico de ações da sede."
            maxLength={500}
            obrigatorio
            erro={erroMotivo}
            value={motivo}
            onChange={(evento) => setMotivo(evento.target.value)}
          />
          <p className="mb-0">
            {associado.email
              ? 'O associado recebe agora um e-mail avisando da interrupção.'
              : 'Este associado não tem e-mail no cadastro, então não recebe o aviso.'}
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Botao variant="outline-secondary" onClick={fechar}>
            Cancelar
          </Botao>
          <Botao type="submit" variant="danger" disabled={enviando}>
            Sim, interromper
          </Botao>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
