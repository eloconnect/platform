import type {
  AcessoManualStatus,
  Associado,
  AssociadoDetalhe,
  StatusCancelamento,
} from '@eloconnect/shared';
import {
  acessoManualEmVigor,
  ApiError,
  formatarCnpj,
  podeAcessarRecursoRestrito,
} from '@eloconnect/shared';
import { useEffect, useState } from 'react';
import Form from 'react-bootstrap/Form';
import Modal from 'react-bootstrap/Modal';
import { Link, useLocation, useParams } from 'react-router';
import { api } from '../../api';
import { ehChaveMestre } from '../../sessao';
import {
  AvisoSucesso,
  Botao,
  CampoTexto,
  MensagemErro,
  useTituloPagina,
} from '../../componentes';
import { SecaoProximoBoleto } from './SecaoProximoBoleto';
import { textosSituacao } from './situacaoAssociado';

type Resultado =
  | { tipo: 'ok'; associado: AssociadoDetalhe }
  | { tipo: 'nao-encontrado' }
  | { tipo: 'erro' };

const STATUS_CANCELAMENTO: Record<StatusCancelamento, string> = {
  PENDENTE: 'Pendente',
  APROVADA: 'Aprovada',
  RECUSADA: 'Recusada',
};

/** Textos de cada decisão da sede sobre o acesso (RF09, RN11). */
const DECISOES_ACESSO: {
  valor: AcessoManualStatus;
  botao: string;
  titulo: string;
  explicacao: string;
  aviso: string;
}[] = [
  {
    valor: 'BLOQUEADO',
    botao: 'Bloquear acesso',
    titulo: 'Bloquear o acesso?',
    explicacao:
      'O associado perde o acesso a benefícios e suporte, mesmo com o pagamento em dia, até a sede mudar de novo.',
    aviso: 'Acesso bloqueado.',
  },
  {
    valor: 'LIBERADO',
    botao: 'Liberar acesso',
    titulo: 'Liberar o acesso?',
    explicacao:
      'O associado tem acesso a benefícios e suporte por 7 dias, mesmo com o pagamento em atraso, e vê um aviso com a data de fim. Depois, o acesso volta a seguir o pagamento.',
    aviso: 'Acesso liberado.',
  },
  {
    valor: null,
    botao: 'Voltar a seguir o pagamento',
    titulo: 'Voltar a seguir o pagamento?',
    explicacao:
      'O acesso a benefícios e suporte volta a depender só do pagamento.',
    aviso: 'O acesso voltou a seguir o pagamento.',
  },
];

/**
 * Perfil do associado para a sede (US07, RF07): situação, dados cadastrais e
 * solicitações de cancelamento. O histórico de boletos entra com a cobrança.
 * Daqui a sede edita, inativa e reativa o associado (US08, RF08), bloqueia ou
 * libera o acesso a benefícios e suporte (US09, RF09) e muda o valor do
 * próximo boleto (US11, RF11).
 */
export function PaginaPerfilAssociado() {
  const { id = '' } = useParams();
  const { state } = useLocation();
  const [aviso, setAviso] = useState(() => lerAviso(state));
  // Guarda de qual associado é o resultado: se o endereço mudou, está carregando.
  const [resultado, setResultado] = useState<
    (Resultado & { id: string }) | null
  >(null);

  useEffect(() => {
    let ativo = true;
    void api
      .buscarAssociado(id)
      .then((associado) => ativo && setResultado({ id, tipo: 'ok', associado }))
      .catch(
        (e: unknown) =>
          ativo &&
          setResultado({
            id,
            // 400 é um endereço com id inválido: para quem usa, dá no mesmo.
            tipo:
              e instanceof ApiError && (e.status === 404 || e.status === 400)
                ? 'nao-encontrado'
                : 'erro',
          }),
      );
    return () => {
      ativo = false;
    };
  }, [id]);

  const estado: Resultado | { tipo: 'carregando' } =
    resultado?.id === id ? resultado : { tipo: 'carregando' };
  const titulo =
    estado.tipo === 'ok'
      ? estado.associado.razaoSocial
      : estado.tipo === 'nao-encontrado'
        ? 'Associado não encontrado'
        : 'Associado';
  useTituloPagina(titulo);

  return (
    <>
      <Link to="/admin/associados">Voltar para a lista de associados</Link>
      <h1 className="mt-3">{titulo}</h1>
      {aviso && <AvisoSucesso>{aviso}</AvisoSucesso>}

      {estado.tipo === 'carregando' && <p role="status">Carregando...</p>}
      {estado.tipo === 'nao-encontrado' && (
        <p>Confira o endereço ou procure o associado na lista.</p>
      )}
      {estado.tipo === 'erro' && (
        <MensagemErro>
          Não foi possível carregar o associado agora. Tente de novo em alguns
          minutos.
        </MensagemErro>
      )}
      {estado.tipo === 'ok' && (
        <Perfil
          associado={estado.associado}
          aoAtualizar={(atualizado, mensagem) => {
            setResultado({
              id,
              tipo: 'ok',
              associado: { ...estado.associado, ...atualizado },
            });
            setAviso(mensagem);
          }}
        />
      )}
    </>
  );
}

function Perfil({
  associado,
  aoAtualizar,
}: {
  associado: AssociadoDetalhe;
  aoAtualizar: (atualizado: Partial<AssociadoDetalhe>, aviso: string) => void;
}) {
  // O perfil básico da sede só consulta (RN33).
  const chaveMestre = ehChaveMestre();
  const [confirmando, setConfirmando] = useState(false);
  const [decisaoAcesso, setDecisaoAcesso] = useState<
    (typeof DECISOES_ACESSO)[number] | null
  >(null);
  const cancelamentoSolicitado = associado.cancelamentos.some(
    (solicitacao) => solicitacao.status === 'PENDENTE',
  );
  const dados: [string, string | null][] = [
    ['CNPJ', formatarCnpj(associado.cnpj)],
    ['Razão social', associado.razaoSocial],
    ['Nome fantasia', associado.nomeFantasia],
    ['E-mail', associado.email],
    ['Telefone', associado.telefone],
    ['Município', associado.municipio],
    ['Cadastrado em', formatarData(associado.criadoEm)],
  ];
  if (associado.inativadoEm) {
    dados.push(['Inativado em', formatarData(associado.inativadoEm)]);
  }

  return (
    <>
      {chaveMestre && (
        <div className="d-flex flex-wrap gap-3 mt-3">
          <Link
            className="btn btn-primary btn-lg"
            to={`/admin/associados/${associado.id}/editar`}
          >
            Editar dados
          </Link>
          <Botao
            variant={
              associado.inativadoEm ? 'outline-primary' : 'outline-danger'
            }
            onClick={() => setConfirmando(true)}
          >
            {associado.inativadoEm
              ? 'Reativar associado'
              : 'Inativar associado'}
          </Botao>
        </div>
      )}
      <JanelaInativacao
        associado={associado}
        aberta={confirmando}
        aoFechar={() => setConfirmando(false)}
        aoConcluir={(atualizado, mensagem) => {
          setConfirmando(false);
          aoAtualizar(atualizado, mensagem);
        }}
      />

      <section className="mt-4">
        <h2>Situação</h2>
        <ul>
          {textosSituacao({ ...associado, cancelamentoSolicitado }).map(
            (texto) => (
              <li key={texto}>{texto}</li>
            ),
          )}
          <li>
            Recebe boleto mensal: {associado.contribuicaoAtiva ? 'Sim' : 'Não'}
          </li>
        </ul>
      </section>

      <section className="mt-4">
        <h2>Acesso a benefícios e suporte</h2>
        <p>{textoAcesso(associado)}</p>
        {chaveMestre && (
          <div className="d-flex flex-wrap gap-3">
            {DECISOES_ACESSO.filter(
              ({ valor }) =>
                valor !==
                acessoManualEmVigor(
                  associado.acessoManual,
                  associado.acessoManualAte,
                ),
            ).map((decisao) => (
              <Botao
                key={decisao.botao}
                variant="outline-primary"
                onClick={() => setDecisaoAcesso(decisao)}
              >
                {decisao.botao}
              </Botao>
            ))}
          </div>
        )}
        <JanelaAcesso
          associado={associado}
          decisao={decisaoAcesso}
          aoFechar={() => setDecisaoAcesso(null)}
          aoConcluir={(atualizado, mensagem) => {
            setDecisaoAcesso(null);
            aoAtualizar(atualizado, mensagem);
          }}
        />
      </section>

      <section className="mt-4">
        <h2>Dados cadastrais</h2>
        <dl className="row">
          {dados.map(([rotulo, valor]) => (
            <div key={rotulo} className="d-sm-flex">
              <dt className="col-sm-4">{rotulo}</dt>
              <dd className="col-sm-8">{valor ?? 'Não informado'}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-4">
        <h2>Conta de acesso</h2>
        <p>{textoConta(associado.conta)}</p>
      </section>

      <section className="mt-4">
        <h2>Solicitações de cancelamento</h2>
        {associado.cancelamentos.length === 0 ? (
          <p>Nenhuma solicitação.</p>
        ) : (
          <ul>
            {associado.cancelamentos.map((solicitacao) => (
              <li key={solicitacao.id} className="mb-3">
                <strong>{STATUS_CANCELAMENTO[solicitacao.status]}</strong>,
                pedida em {formatarData(solicitacao.solicitadaEm)}.
                {solicitacao.motivo && <div>Motivo: {solicitacao.motivo}</div>}
                {solicitacao.decididaEm && (
                  <div>
                    Decidida em {formatarData(solicitacao.decididaEm)}
                    {solicitacao.decididaPor &&
                      ` por ${solicitacao.decididaPor.nome}`}
                    .
                  </div>
                )}
                {solicitacao.observacaoSede && (
                  <div>Observação da sede: {solicitacao.observacaoSede}</div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <SecaoProximoBoleto
        associado={associado}
        aoAtualizar={(proximoBoleto, mensagem) =>
          aoAtualizar({ proximoBoleto }, mensagem)
        }
      />

      <section className="mt-4">
        <h2>Histórico de boletos e pagamentos</h2>
        <p>Em construção.</p>
      </section>
    </>
  );
}

/**
 * Confirmação antes de inativar ou reativar. Reativar está [A confirmar] com o
 * cliente (P13). O que a inativação muda na conta e na cobrança também (P13),
 * então o texto fala só da lista.
 */
function JanelaInativacao({
  associado,
  aberta,
  aoFechar,
  aoConcluir,
}: {
  associado: AssociadoDetalhe;
  aberta: boolean;
  aoFechar: () => void;
  aoConcluir: (atualizado: Associado, aviso: string) => void;
}) {
  const inativado = associado.inativadoEm !== null;
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
      const atualizado = inativado
        ? await api.reativarAssociado(associado.id)
        : await api.inativarAssociado(associado.id);
      aoConcluir(
        atualizado,
        inativado ? 'Associado reativado.' : 'Associado inativado.',
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
      aria-labelledby="titulo-janela-inativacao"
    >
      <Modal.Header closeButton closeLabel="Fechar">
        <Modal.Title as="h2" className="h4" id="titulo-janela-inativacao">
          {inativado ? 'Reativar associado?' : 'Inativar associado?'}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {erro && (
          <MensagemErro>
            Não foi possível {inativado ? 'reativar' : 'inativar'} agora. Tente
            de novo em alguns minutos.
          </MensagemErro>
        )}
        {inativado ? (
          <p className="mb-0">
            {associado.razaoSocial} volta a aparecer na lista de associados.
          </p>
        ) : (
          <p className="mb-0">
            {associado.razaoSocial} deixa de aparecer na lista de associados. Os
            dados continuam guardados e aparecem ao marcar &quot;Mostrar também
            os inativados&quot;.
          </p>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Botao variant="outline-secondary" onClick={fechar}>
          Cancelar
        </Botao>
        <Botao
          variant={inativado ? 'primary' : 'danger'}
          disabled={enviando}
          onClick={() => void confirmar()}
        >
          {inativado ? 'Sim, reativar' : 'Sim, inativar'}
        </Botao>
      </Modal.Footer>
    </Modal>
  );
}

/**
 * Confirmação da decisão sobre o acesso, com o motivo, que fica só no log de
 * auditoria (RN26).
 */
function JanelaAcesso({
  associado,
  decisao,
  aoFechar,
  aoConcluir,
}: {
  associado: AssociadoDetalhe;
  decisao: (typeof DECISOES_ACESSO)[number] | null;
  aoFechar: () => void;
  aoConcluir: (atualizado: Associado, aviso: string) => void;
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

  async function confirmar() {
    if (!decisao) return;
    if (!motivo.trim()) {
      setErroMotivo('Escreva o motivo.');
      return;
    }
    setErroMotivo(undefined);
    setEnviando(true);
    setErro(false);
    try {
      const atualizado = await api.definirAcesso(associado.id, {
        acessoManual: decisao.valor,
        motivo: motivo.trim(),
      });
      setMotivo('');
      aoConcluir(atualizado, decisao.aviso);
    } catch {
      setErro(true);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      show={decisao !== null}
      onHide={fechar}
      centered
      aria-labelledby="titulo-janela-acesso"
    >
      <Form
        onSubmit={(event) => {
          event.preventDefault();
          void confirmar();
        }}
      >
        <Modal.Header closeButton closeLabel="Fechar">
          <Modal.Title as="h2" className="h4" id="titulo-janela-acesso">
            {decisao?.titulo}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {erro && (
            <MensagemErro>
              Não foi possível mudar o acesso agora. Tente de novo em alguns
              minutos.
            </MensagemErro>
          )}
          <p>{decisao?.explicacao}</p>
          <CampoTexto
            rotulo="Motivo"
            ajuda="Fica registrado no histórico de ações da sede."
            maxLength={500}
            obrigatorio
            erro={erroMotivo}
            value={motivo}
            onChange={(event) => setMotivo(event.target.value)}
          />
        </Modal.Body>
        <Modal.Footer>
          <Botao variant="outline-secondary" onClick={fechar}>
            Cancelar
          </Botao>
          <Botao type="submit" disabled={enviando}>
            Confirmar
          </Botao>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

/**
 * Como está o acesso a benefícios e suporte hoje (RN11). A liberação vale 7
 * dias; o bloqueio, até a sede mudar de novo.
 */
function textoAcesso(associado: AssociadoDetalhe): string {
  const emVigor = acessoManualEmVigor(
    associado.acessoManual,
    associado.acessoManualAte,
  );
  if (emVigor === 'BLOQUEADO') {
    return 'Bloqueado pela sede, mesmo que o pagamento esteja em dia.';
  }
  if (emVigor === 'LIBERADO') {
    return associado.acessoManualAte
      ? `Liberado pela sede até ${formatarData(associado.acessoManualAte)}, mesmo que o pagamento esteja em atraso. Depois, volta a seguir o pagamento.`
      : 'Liberado pela sede, mesmo que o pagamento esteja em atraso.';
  }
  return podeAcessarRecursoRestrito(associado.situacao, null)
    ? 'Segue o pagamento. Hoje está liberado.'
    : 'Segue o pagamento. Hoje está bloqueado.';
}

/** Aviso deixado pela página anterior (ex.: "Dados salvos." depois de editar). */
function lerAviso(estado: unknown): string | null {
  return typeof estado === 'object' &&
    estado !== null &&
    'aviso' in estado &&
    typeof estado.aviso === 'string'
    ? estado.aviso
    : null;
}

/** A conta é criada pelo próprio associado, pelo CNPJ (RF05). */
function textoConta(conta: AssociadoDetalhe['conta']): string {
  if (!conta) return 'Ainda não criada pelo associado.';
  if (!conta.confirmadaEm) {
    return `Pedida em ${formatarData(conta.criadaEm)}. Aguardando o associado criar a senha pelo link enviado para ${conta.email}.`;
  }
  return `Criada em ${formatarData(conta.confirmadaEm)}. O associado entra com o e-mail ${conta.email}.`;
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}
