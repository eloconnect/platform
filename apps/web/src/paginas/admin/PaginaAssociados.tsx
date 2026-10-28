import type {
  FiltrosAssociados,
  ListaAssociados,
  StatusAssociado,
} from '@eloconnect/shared';
import { formatarCnpj } from '@eloconnect/shared';
import { useEffect, useState, type FormEvent } from 'react';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';
import Table from 'react-bootstrap/Table';
import { Link, useSearchParams } from 'react-router';
import { api } from '../../api';
import { ehChaveMestre } from '../../sessao';
import {
  Botao,
  CampoTexto,
  MensagemErro,
  useTituloPagina,
} from '../../componentes';
import { textosSituacao } from './situacaoAssociado';

const OPCOES_SITUACAO: [StatusAssociado, string][] = [
  ['ADIMPLENTE', 'Adimplente'],
  ['INADIMPLENTE', 'Inadimplente'],
  ['SEM_CONTRIBUICAO', 'Sem contribuição ativa'],
  ['CANCELAMENTO_SOLICITADO', 'Cancelamento solicitado'],
];

const CAMPOS_FILTRO = [
  'busca',
  'status',
  'contribuicaoAtiva',
  'incluirInativos',
] as const;

type Resultado = { tipo: 'ok'; lista: ListaAssociados } | { tipo: 'erro' };

/**
 * Lista de associados da sede, com busca, filtros e páginas (US06, RF06).
 * Os filtros ficam no endereço, para o "Voltar" do navegador manter a busca.
 */
export function PaginaAssociados() {
  useTituloPagina('Associados');
  const [parametros, setParametros] = useSearchParams();
  const chave = parametros.toString();
  // Guarda de qual busca é o resultado: se o endereço mudou, está carregando.
  const [resultado, setResultado] = useState<
    (Resultado & { chave: string }) | null
  >(null);

  useEffect(() => {
    let ativo = true;
    void api
      .listarAssociados(lerFiltros(new URLSearchParams(chave)))
      .then((lista) => ativo && setResultado({ chave, tipo: 'ok', lista }))
      .catch(() => ativo && setResultado({ chave, tipo: 'erro' }));
    return () => {
      ativo = false;
    };
  }, [chave]);

  const estado: Resultado | { tipo: 'carregando' } =
    resultado?.chave === chave ? resultado : { tipo: 'carregando' };

  function buscar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const dados = new FormData(evento.currentTarget);
    const novos = new URLSearchParams();
    for (const campo of CAMPOS_FILTRO) {
      const valor = dados.get(campo);
      if (typeof valor === 'string' && valor.trim()) {
        novos.set(campo, valor.trim());
      }
    }
    setParametros(novos);
  }

  function irParaPagina(pagina: number) {
    const novos = new URLSearchParams(parametros);
    novos.set('pagina', String(pagina));
    setParametros(novos);
  }

  const filtros = lerFiltros(parametros);
  const lista = estado.tipo === 'ok' ? estado.lista : null;
  const totalPaginas = lista
    ? Math.max(1, Math.ceil(lista.total / lista.porPagina))
    : 1;

  return (
    <>
      <h1>Associados</h1>
      {ehChaveMestre() && (
        <Link
          className="btn btn-primary btn-lg mb-4"
          to="/admin/associados/novo"
        >
          Cadastrar associado
        </Link>
      )}

      {/* A key recria o formulário quando o endereço muda (ex.: "Voltar"). */}
      <Form
        key={chave}
        role="search"
        aria-label="Buscar associados"
        onSubmit={buscar}
      >
        <Row>
          <Col lg={6}>
            <CampoTexto
              rotulo="Buscar por nome ou CNPJ"
              name="busca"
              type="search"
              defaultValue={filtros.busca ?? ''}
            />
          </Col>
          <Col sm={6} lg={3}>
            <Form.Group className="mb-4" controlId="filtro-situacao">
              <Form.Label>Situação</Form.Label>
              <Form.Select
                size="lg"
                name="status"
                defaultValue={filtros.status ?? ''}
              >
                <option value="">Todas</option>
                {OPCOES_SITUACAO.map(([valor, texto]) => (
                  <option key={valor} value={valor}>
                    {texto}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </Col>
          <Col sm={6} lg={3}>
            <Form.Group className="mb-4" controlId="filtro-boleto">
              <Form.Label>Recebe boleto mensal</Form.Label>
              <Form.Select
                size="lg"
                name="contribuicaoAtiva"
                defaultValue={
                  filtros.contribuicaoAtiva === undefined
                    ? ''
                    : String(filtros.contribuicaoAtiva)
                }
              >
                <option value="">Todos</option>
                <option value="true">Sim</option>
                <option value="false">Não</option>
              </Form.Select>
            </Form.Group>
          </Col>
        </Row>
        <Form.Check
          className="mb-4"
          id="filtro-inativos"
          name="incluirInativos"
          value="true"
          label="Mostrar também os inativados"
          defaultChecked={filtros.incluirInativos ?? false}
        />
        <Botao type="submit">Buscar</Botao>
      </Form>

      <p role="status" className="mt-4">
        {estado.tipo === 'carregando' && 'Carregando a lista...'}
        {lista && resumo(lista.total)}
      </p>

      {estado.tipo === 'erro' && (
        <MensagemErro>
          Não foi possível carregar a lista agora. Tente de novo em alguns
          minutos.
        </MensagemErro>
      )}

      {lista && lista.itens.length > 0 && (
        <>
          <Table responsive>
            <thead>
              <tr>
                <th scope="col">Associado</th>
                <th scope="col">CNPJ</th>
                <th scope="col">Situação</th>
                <th scope="col">Recebe boleto mensal</th>
              </tr>
            </thead>
            <tbody>
              {lista.itens.map((associado) => (
                <tr key={associado.id}>
                  <td>
                    <Link to={`/admin/associados/${associado.id}`}>
                      {associado.razaoSocial}
                    </Link>
                    {associado.nomeFantasia && (
                      <div className="text-body-secondary">
                        {associado.nomeFantasia}
                      </div>
                    )}
                  </td>
                  <td className="text-nowrap">
                    {formatarCnpj(associado.cnpj)}
                  </td>
                  <td>
                    <ul className="list-unstyled mb-0">
                      {textosSituacao(associado).map((texto) => (
                        <li key={texto}>{texto}</li>
                      ))}
                    </ul>
                  </td>
                  <td>{associado.contribuicaoAtiva ? 'Sim' : 'Não'}</td>
                </tr>
              ))}
            </tbody>
          </Table>

          {totalPaginas > 1 && (
            <nav
              aria-label="Páginas da lista"
              className="d-flex flex-wrap align-items-center gap-3"
            >
              <Botao
                variant="outline-primary"
                disabled={lista.pagina <= 1}
                onClick={() => irParaPagina(lista.pagina - 1)}
              >
                Página anterior
              </Botao>
              <span>
                Página {lista.pagina} de {totalPaginas}
              </span>
              <Botao
                variant="outline-primary"
                disabled={lista.pagina >= totalPaginas}
                onClick={() => irParaPagina(lista.pagina + 1)}
              >
                Próxima página
              </Botao>
            </nav>
          )}
        </>
      )}
    </>
  );
}

/** Filtros do endereço. Valores que a API não aceita são ignorados. */
function lerFiltros(parametros: URLSearchParams): FiltrosAssociados {
  const pagina = Number(parametros.get('pagina'));
  return {
    busca: parametros.get('busca')?.trim() || undefined,
    status: OPCOES_SITUACAO.find(
      ([valor]) => valor === parametros.get('status'),
    )?.[0],
    contribuicaoAtiva: lerSimNao(parametros.get('contribuicaoAtiva')),
    incluirInativos: parametros.get('incluirInativos') === 'true' || undefined,
    pagina: Number.isInteger(pagina) && pagina > 1 ? pagina : undefined,
  };
}

function lerSimNao(valor: string | null): boolean | undefined {
  if (valor === 'true') return true;
  if (valor === 'false') return false;
  return undefined;
}

function resumo(total: number): string {
  if (total === 0) return 'Nenhum associado encontrado.';
  if (total === 1) return '1 associado encontrado.';
  return `${total} associados encontrados.`;
}
