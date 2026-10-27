import type { AssociadoDetalhe, StatusCancelamento } from '@eloconnect/shared';
import { ApiError, formatarCnpj } from '@eloconnect/shared';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { api } from '../../api';
import { MensagemErro, useTituloPagina } from '../../componentes';
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
 */
export function PaginaPerfilAssociado() {
  const { id = '' } = useParams();
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
      {estado.tipo === 'ok' && <Perfil associado={estado.associado} />}
    </>
  );
}

function Perfil({ associado }: { associado: AssociadoDetalhe }) {
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

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}
