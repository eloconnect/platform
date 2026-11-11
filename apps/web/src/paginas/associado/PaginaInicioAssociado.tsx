import type {
  BoletoEmAberto,
  MinhaConta,
  TextoSituacao,
} from '@eloconnect/shared';
import {
  formatarDia,
  formatarReais,
  textoCompetencia,
} from '@eloconnect/shared';
import { useEffect, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import { Link, useLocation } from 'react-router';
import { api } from '../../api';
import {
  AvisoSucesso,
  Carregando,
  EtiquetaSituacao,
  Icone,
  lerAviso,
  MensagemErro,
  useTituloPagina,
  type NomeIcone,
} from '../../componentes';
import { PRAZO_DA_SEDE } from './cancelamento';

/** A situação numa frase simples, ao lado da etiqueta (RN22). */
const FRASE_SITUACAO: Record<TextoSituacao, string> = {
  Adimplente: 'A contribuição da farmácia está em dia.',
  Inadimplente: 'A farmácia tem contribuição em atraso.',
  'Sem contribuição ativa':
    'A farmácia está no cadastro, mas não recebe o boleto mensal.',
};

type EstadoBoletos = BoletoEmAberto[] | 'carregando' | 'erro';

/** O início serve de menu: cada área num cartão grande, com ícone e palavra. */
const AREAS: {
  para: string;
  icone: NomeIcone;
  titulo: string;
  texto: string;
}[] = [
  {
    para: '/associado/boletos',
    icone: 'boleto',
    titulo: 'Meus boletos',
    texto: 'Pagar com Pix ou com o boleto.',
  },
  {
    para: '/associado/historico',
    icone: 'historico',
    titulo: 'Histórico de pagamentos',
    texto: 'Todos os boletos, pagos ou não.',
  },
  {
    para: '/associado/noticias',
    icone: 'noticia',
    titulo: 'Notícias',
    texto: 'Avisos e novidades do sindicato.',
  },
  {
    para: '/associado/convencoes',
    icone: 'documento',
    titulo: 'Convenções',
    texto: 'Convenções coletivas para consultar.',
  },
];

/**
 * Início da área do associado, que responde primeiro "está tudo certo?":
 * a situação dele, o boleto em aberto mais antigo (ou que não há boleto para
 * pagar), as áreas do site em cartões grandes, quando a sede liberou o acesso, o aviso com a data de fim da
 * liberação (RN11, RN22), o convite para receber o boleto todo mês, para quem
 * ainda não recebe (RN23), e, para quem recebe, o caminho para cancelar ou o
 * pedido que espera a sede (RN18).
 */
export function PaginaInicioAssociado() {
  useTituloPagina('Área do associado');
  // Aviso do pedido de cancelamento, que traz o associado para cá (RN18).
  const aviso = lerAviso(useLocation().state);
  const [conta, setConta] = useState<MinhaConta | null>(null);
  const [erro, setErro] = useState(false);
  // Em dia ou não, o associado vê os boletos em aberto (RF12). Quem teve a
  // cobrança interrompida também pode ter um boleto que já saiu (RN25).
  const [boletos, setBoletos] = useState<EstadoBoletos>('carregando');

  useEffect(() => {
    let ativo = true;
    void api
      .minhaConta()
      .then((resposta) => ativo && setConta(resposta))
      .catch(() => ativo && setErro(true));
    void api
      .listarMeusBoletos()
      .then((lista) => ativo && setBoletos(lista))
      .catch(() => ativo && setBoletos('erro'));
    return () => {
      ativo = false;
    };
  }, []);

  // O mais antigo primeiro: é o que vence ou expira antes. Ordena uma cópia
  // (o toSorted não está no lib do TypeScript do projeto).
  const emAberto = Array.isArray(boletos)
    ? // oxlint-disable-next-line unicorn/no-array-sort
      [...boletos].sort((a, b) => a.vencimento.localeCompare(b.vencimento))
    : [];

  return (
    <>
      {aviso && <AvisoSucesso>{aviso}</AvisoSucesso>}
      <section className="elo-boas-vindas" aria-labelledby="titulo-area">
        <h1 id="titulo-area">Área do associado</h1>
        {erro && (
          <MensagemErro>
            Não foi possível carregar os seus dados agora. Tente de novo em
            alguns minutos.
          </MensagemErro>
        )}
        {!erro && !conta && <Carregando texto="Carregando..." />}
        {conta && (
          <>
            <p className="elo-nome-farmacia">{conta.nome}</p>
            <p className="d-flex flex-wrap align-items-center gap-2 mb-0">
              <EtiquetaSituacao
                situacao={conta.situacao}
                prefixo="Situação: "
              />
              <span className="elo-frase-situacao">
                {FRASE_SITUACAO[conta.situacao]}
              </span>
            </p>
          </>
        )}
      </section>

      {conta?.acessoLiberadoAte && (
        <Alert variant="warning">
          <Alert.Heading as="h2" className="h5">
            Acesso liberado pela sede até{' '}
            {new Date(conta.acessoLiberadoAte).toLocaleDateString('pt-BR')}
          </Alert.Heading>
          <p className="mb-0">
            A sede liberou o seu acesso a benefícios e suporte até essa data.
            Depois dela, o acesso volta a depender do pagamento em dia.
          </p>
        </Alert>
      )}

      {emAberto.length > 0 && (
        <CartaoProximoBoleto
          boleto={emAberto[0]}
          outros={emAberto.length - 1}
        />
      )}
      {emAberto.length === 0 &&
        Array.isArray(boletos) &&
        conta?.recebeBoletoMensal &&
        conta.situacao === 'Adimplente' && (
          <section className="elo-tudo-certo" aria-labelledby="titulo-em-dia">
            <span className="elo-picto">
              <Icone nome="visto" />
            </span>
            <div>
              <h2 id="titulo-em-dia">Nenhum boleto para pagar agora</h2>
              <p className="mb-0">
                O próximo boleto aparece aqui e chega por e-mail no começo do
                mês.
              </p>
            </div>
          </section>
        )}
      {boletos === 'erro' && (
        <p className="mb-4">
          Não foi possível conferir os boletos agora.{' '}
          <Link to="/associado/boletos">Abrir a página de boletos</Link>
        </p>
      )}

      {conta && !conta.recebeBoletoMensal && (
        <section className="elo-boleto" aria-labelledby="titulo-adesao">
          <h2 id="titulo-adesao">Receber o boleto todo mês</h2>
          <div className="elo-boleto-corpo">
            <p className="mb-0">
              A farmácia ainda não recebe o boleto da contribuição todo mês.
            </p>
            <Link className="btn btn-primary btn-lg" to="/associado/adesao">
              Quero receber o boleto todo mês
            </Link>
          </div>
        </section>
      )}

      <h2 className="h4 mb-3">Na sua área</h2>
      <ul className="elo-atalhos list-unstyled">
        {AREAS.map((area) => (
          <li key={area.para}>
            <Link className="elo-atalho" to={area.para}>
              <span className="elo-picto">
                <Icone nome={area.icone} />
              </span>
              <span>
                <strong>{area.titulo}</strong>
                {area.texto}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {conta?.recebeBoletoMensal && (
        <section className="elo-rodape-pagina" aria-label="Boleto mensal">
          {conta.cancelamentoPedidoEm ? (
            <p className="mb-0">
              O cancelamento do boleto mensal foi pedido em{' '}
              {new Date(conta.cancelamentoPedidoEm).toLocaleDateString('pt-BR')}
              . {PRAZO_DA_SEDE} Até lá, a farmácia continua recebendo o boleto.
            </p>
          ) : (
            <p className="mb-0">
              A farmácia recebe o boleto da contribuição todo mês.{' '}
              <Link to="/associado/cancelamento">Cancelar o boleto mensal</Link>
            </p>
          )}
        </section>
      )}
    </>
  );
}

function CartaoProximoBoleto({
  boleto,
  outros,
}: {
  boleto: BoletoEmAberto;
  outros: number;
}) {
  const mes = textoCompetencia(boleto.competencia);
  return (
    <section
      className={`elo-boleto${boleto.vencido ? ' elo-boleto--vencido' : ''}`}
      aria-labelledby="titulo-boleto"
    >
      <h2 id="titulo-boleto">
        {boleto.vencido
          ? `O boleto de ${mes} venceu em ${formatarDia(boleto.vencimento)}`
          : `Boleto de ${mes}`}
      </h2>
      {boleto.vencido && (
        <p>
          Você ainda pode pagar este boleto até{' '}
          <strong>{formatarDia(boleto.validoAte)}</strong>.
        </p>
      )}
      <div className="elo-boleto-corpo">
        <dl>
          <div>
            <dt>Valor</dt>
            <dd className="elo-valor">{formatarReais(boleto.valor)}</dd>
          </div>
          {!boleto.vencido && (
            <div>
              <dt>Vencimento</dt>
              <dd>{formatarDia(boleto.vencimento)}</dd>
            </div>
          )}
        </dl>
        <Link className="btn btn-primary btn-lg" to="/associado/boletos">
          Ver meu boleto
          <Icone nome="seta" />
        </Link>
      </div>
      {outros > 0 && (
        <p className="mt-3 mb-0">
          {outros === 1
            ? 'Há mais 1 boleto em aberto na página de boletos.'
            : `Há mais ${outros} boletos em aberto na página de boletos.`}
        </p>
      )}
    </section>
  );
}
