import type { Comunicado, PainelComunicados } from '@eloconnect/shared';
import { ApiError, LIMITES_COMUNICADO } from '@eloconnect/shared';
import { useEffect, useState, type FormEvent } from 'react';
import Form from 'react-bootstrap/Form';
import Modal from 'react-bootstrap/Modal';
import { api } from '../../api';
import {
  AvisoSucesso,
  Botao,
  CampoTexto,
  MensagemErro,
  useTituloPagina,
} from '../../componentes';

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'erro' }
  | { tipo: 'ok'; painel: PainelComunicados };

/**
 * Cobrança formal (US29: RF29, RN19): o chave mestre escreve o comunicado,
 * que vai por e-mail, sem boleto, a todos os associados do cadastro. O envio
 * sai em partes, dentro do limite diário do provedor (RNF09), e a página
 * mostra quantos e-mails já saíram.
 */
export function PaginaCobrancaFormal() {
  useTituloPagina('Cobrança formal');
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' });
  const [aviso, setAviso] = useState<string | null>(null);

  function carregar() {
    return api
      .painelComunicados()
      .then((painel) => setEstado({ tipo: 'ok', painel }))
      .catch(() => setEstado({ tipo: 'erro' }));
  }

  useEffect(() => {
    let ativo = true;
    void api
      .painelComunicados()
      .then((painel) => ativo && setEstado({ tipo: 'ok', painel }))
      .catch(() => ativo && setEstado({ tipo: 'erro' }));
    return () => {
      ativo = false;
    };
  }, []);

  const emAndamento =
    estado.tipo === 'ok'
      ? estado.painel.comunicados.find((c) => c.concluidoEm === null)
      : undefined;

  return (
    <>
      <h1>Cobrança formal</h1>
      {aviso && <AvisoSucesso>{aviso}</AvisoSucesso>}
      {estado.tipo === 'carregando' && <p role="status">Carregando...</p>}
      {estado.tipo === 'erro' && (
        <MensagemErro>
          Não foi possível carregar a cobrança formal agora. Tente de novo em
          alguns minutos.
        </MensagemErro>
      )}
      {estado.tipo === 'ok' && (
        <>
          <p>
            O comunicado vai por e-mail, sem boleto, para todos os associados do
            cadastro com e-mail, pagando ou não, menos os inativados. Hoje são{' '}
            {estado.painel.destinatarios}.
          </p>
          <p>
            Saem até {estado.painel.limiteDiario} e-mails por dia, a partir da
            próxima execução diária, por volta das 7h40 (horário de Mato
            Grosso).
          </p>
          {emAndamento ? (
            <p>
              <strong>
                Espere o envio do comunicado atual terminar para mandar outro.
              </strong>
            </p>
          ) : (
            <FormularioComunicado
              painel={estado.painel}
              aoCriar={() => {
                setAviso(
                  'Comunicado criado. O envio começa na próxima execução diária.',
                );
                void carregar();
              }}
            />
          )}
          <h2 className="mt-5">Comunicados</h2>
          {estado.painel.comunicados.length === 0 ? (
            <p>Nenhum comunicado ainda.</p>
          ) : (
            <ul className="list-unstyled">
              {estado.painel.comunicados.map((comunicado) => (
                <ItemComunicado key={comunicado.id} comunicado={comunicado} />
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}

/** Assunto e texto do comunicado, com a confirmação antes de enviar. */
function FormularioComunicado({
  painel,
  aoCriar,
}: {
  painel: PainelComunicados;
  aoCriar: () => void;
}) {
  const [assunto, setAssunto] = useState('');
  const [texto, setTexto] = useState('');
  const [erros, setErros] = useState<{ assunto?: string; texto?: string }>({});
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const dias = Math.max(
    1,
    Math.ceil(painel.destinatarios / painel.limiteDiario),
  );

  function revisar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const novos = {
      ...(!assunto.trim() && { assunto: 'Escreva o assunto.' }),
      ...(!texto.trim() && { texto: 'Escreva o texto do comunicado.' }),
    };
    setErros(novos);
    if (!novos.assunto && !novos.texto) setConfirmando(true);
  }

  async function enviar() {
    setEnviando(true);
    setErro(null);
    try {
      await api.criarComunicado({
        assunto: assunto.trim(),
        texto: texto.trim(),
      });
      setConfirmando(false);
      setAssunto('');
      setTexto('');
      aoCriar();
    } catch (e) {
      setErro(
        e instanceof ApiError && e.status < 500
          ? e.message
          : 'Não foi possível criar o comunicado agora. Tente de novo em alguns minutos.',
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Form noValidate onSubmit={revisar}>
      <h2 className="h4">Novo comunicado</h2>
      <CampoTexto
        rotulo="Assunto"
        obrigatorio
        maxLength={LIMITES_COMUNICADO.assunto}
        erro={erros.assunto}
        value={assunto}
        onChange={(evento) => setAssunto(evento.target.value)}
      />
      {/* TODO(P26): o cliente ainda não disse se já tem um texto pronto. */}
      <CampoTexto
        rotulo="Texto do comunicado"
        ajuda="No fim do texto, o sistema acrescenta o valor da contribuição e a lista de benefícios cadastrados."
        obrigatorio
        linhas={10}
        maxLength={LIMITES_COMUNICADO.texto}
        erro={erros.texto}
        value={texto}
        onChange={(evento) => setTexto(evento.target.value)}
      />
      <Botao type="submit">Enviar o comunicado</Botao>

      <Modal
        show={confirmando}
        onHide={() => setConfirmando(false)}
        centered
        aria-labelledby="titulo-janela-comunicado"
      >
        <Modal.Header closeButton closeLabel="Fechar">
          <Modal.Title as="h2" className="h4" id="titulo-janela-comunicado">
            Enviar o comunicado para {painel.destinatarios} associados?
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {erro && <MensagemErro>{erro}</MensagemErro>}
          <p>
            Saem até {painel.limiteDiario} e-mails por dia: o envio leva cerca
            de {dias === 1 ? '1 dia' : `${dias} dias`}.
          </p>
          <p className="mb-0">
            Depois de confirmar, não dá para desfazer. O envio fica no histórico
            de ações da sede.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Botao
            variant="outline-secondary"
            onClick={() => setConfirmando(false)}
          >
            Voltar
          </Botao>
          <Botao disabled={enviando} onClick={() => void enviar()}>
            Sim, enviar
          </Botao>
        </Modal.Footer>
      </Modal>
    </Form>
  );
}

/** Um comunicado, com quantos e-mails saíram e o texto enviado. */
function ItemComunicado({ comunicado }: { comunicado: Comunicado }) {
  return (
    <li className="border-bottom py-3">
      <h3 className="h5">{comunicado.assunto}</h3>
      <p className="mb-1">
        Criado em {formatarData(comunicado.criadoEm)} por{' '}
        {comunicado.criadoPor.nome}.
      </p>
      <p className="mb-1">
        Enviados: {comunicado.enviados} de {comunicado.total}.{' '}
        {comunicado.concluidoEm
          ? `Envio concluído em ${formatarData(comunicado.concluidoEm)}.`
          : 'Enviando.'}
      </p>
      <details>
        <summary>Ver o texto enviado</summary>
        <p className="texto-com-quebras mt-2">{comunicado.mensagem}</p>
      </details>
    </li>
  );
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}
