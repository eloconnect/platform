import type {
  Associado,
  AssociadoDetalhe,
  StatusCancelamento,
} from '@eloconnect/shared';
import { ApiError, formatarCnpj } from '@eloconnect/shared';
import { useEffect, useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import { Link, useLocation, useParams } from 'react-router';
import { api } from '../../api';
import {
  AvisoSucesso,
  Botao,
  MensagemErro,
  useTituloPagina,
} from '../../componentes';
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

/**
 * Perfil do associado para a sede (US07, RF07): situação, dados cadastrais e
 * solicitações de cancelamento. O histórico de boletos entra com a cobrança.
 * Daqui a sede edita, inativa e reativa o associado (US08, RF08).
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
  aoAtualizar: (atualizado: Associado, aviso: string) => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
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
      <div className="d-flex flex-wrap gap-3 mt-3">
        <Link
          className="btn btn-primary btn-lg"
          to={`/admin/associados/${associado.id}/editar`}
        >
          Editar dados
        </Link>
        <Botao
          variant={associado.inativadoEm ? 'outline-primary' : 'outline-danger'}
          onClick={() => setConfirmando(true)}
        >
          {associado.inativadoEm ? 'Reativar associado' : 'Inativar associado'}
        </Botao>
      </div>
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

/** Aviso deixado pela página anterior (ex.: "Dados salvos." depois de editar). */
function lerAviso(estado: unknown): string | null {
  return typeof estado === 'object' &&
    estado !== null &&
    'aviso' in estado &&
    typeof estado.aviso === 'string'
    ? estado.aviso
    : null;
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}
