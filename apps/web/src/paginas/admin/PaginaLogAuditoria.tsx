import type {
  FiltrosLogAuditoria,
  ItemLogAuditoria,
  ListaLogAuditoria,
  UsuarioSede,
  ValorCampoLog,
} from '@eloconnect/shared';
import {
  ACOES_AUDITORIA,
  ehAcaoAuditoria,
  formatarCnpj,
  TEXTO_ACAO_AUDITORIA,
  textoAcaoAuditoria,
} from '@eloconnect/shared';
import { useEffect, useState, type FormEvent } from 'react';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';
import Table from 'react-bootstrap/Table';
import { Link, useSearchParams } from 'react-router';
import { api } from '../../api';
import {
  Botao,
  CampoTexto,
  MensagemErro,
  useTituloPagina,
} from '../../componentes';

const CAMPOS_FILTRO = ['usuarioId', 'associado', 'acao', 'de', 'ate'] as const;

/** Nome de cada campo gravado no log, como aparece na tela. */
const NOMES_CAMPOS: Record<string, string> = {
  cnpj: 'CNPJ',
  razaoSocial: 'Razão social',
  nomeFantasia: 'Nome fantasia',
  email: 'E-mail',
  telefone: 'Telefone',
  municipio: 'Município',
  contribuicaoAtiva: 'Recebe boleto mensal',
  acessoManual: 'Acesso',
  acessoManualAte: 'Liberado até',
  inativadoEm: 'Inativado em',
  motivo: 'Motivo',
  valorMensal: 'Valor mensal',
  valorAnual: 'Valor anual',
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DIA = /^\d{4}-\d{2}-\d{2}$/;
const DATA_HORA_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

type Resultado = { tipo: 'ok'; lista: ListaLogAuditoria } | { tipo: 'erro' };

/**
 * Histórico das ações da sede, com filtros e páginas (US37, RF40). Só o chave
 * mestre vê (RN33). Os filtros ficam no endereço, como na lista de associados.
 */
export function PaginaLogAuditoria() {
  useTituloPagina('Histórico de ações');
  const [parametros, setParametros] = useSearchParams();
  const chave = parametros.toString();
  const [resultado, setResultado] = useState<
    (Resultado & { chave: string }) | null
  >(null);
  const [usuarios, setUsuarios] = useState<UsuarioSede[]>([]);

  useEffect(() => {
    let ativo = true;
    void api
      .listarUsuariosSede()
      .then((lista) => ativo && setUsuarios(lista))
      // Sem a lista, o filtro fica só com "Todos"; o resto da tela funciona.
      .catch(() => undefined);
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    let ativo = true;
    void api
      .listarLogAuditoria(lerFiltros(new URLSearchParams(chave)))
      .then((lista) => ativo && setResultado({ chave, tipo: 'ok', lista }))
      .catch(() => ativo && setResultado({ chave, tipo: 'erro' }));
    return () => {
      ativo = false;
    };
  }, [chave]);

  const estado: Resultado | { tipo: 'carregando' } =
    resultado?.chave === chave ? resultado : { tipo: 'carregando' };

  function filtrar(evento: FormEvent<HTMLFormElement>) {
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
      <h1>Histórico de ações</h1>
      <p>
        Tudo o que a equipe da sede fez no sistema, da ação mais recente para a
        mais antiga. Este histórico não pode ser apagado nem alterado.
      </p>

      {/* A key recria o formulário quando o endereço muda (ex.: "Voltar"). */}
      <Form
        key={chave}
        role="search"
        aria-label="Filtrar o histórico"
        onSubmit={filtrar}
      >
        <Row>
          <Col md={6}>
            <Form.Group className="mb-4" controlId="filtro-usuario">
              <Form.Label>Quem fez</Form.Label>
              {/* Recriado quando a lista chega, para marcar a pessoa do endereço. */}
              <Form.Select
                key={usuarios.length}
                size="lg"
                name="usuarioId"
                defaultValue={filtros.usuarioId ?? ''}
              >
                <option value="">Todos</option>
                {usuarios.map((usuario) => (
                  <option key={usuario.id} value={usuario.id}>
                    {usuario.nome}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group className="mb-4" controlId="filtro-acao">
              <Form.Label>Ação</Form.Label>
              <Form.Select
                size="lg"
                name="acao"
                defaultValue={filtros.acao ?? ''}
              >
                <option value="">Todas</option>
                {ACOES_AUDITORIA.map((acao) => (
                  <option key={acao} value={acao}>
                    {TEXTO_ACAO_AUDITORIA[acao]}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </Col>
          <Col lg={6}>
            <CampoTexto
              rotulo="Associado (nome ou CNPJ)"
              name="associado"
              type="search"
              defaultValue={filtros.associado ?? ''}
            />
          </Col>
          <Col sm={6} lg={3}>
            <CampoTexto
              rotulo="De"
              name="de"
              type="date"
              defaultValue={filtros.de ?? ''}
            />
          </Col>
          <Col sm={6} lg={3}>
            <CampoTexto
              rotulo="Até"
              name="ate"
              type="date"
              defaultValue={filtros.ate ?? ''}
            />
          </Col>
        </Row>
        <Botao type="submit">Filtrar</Botao>
      </Form>

      <p role="status" className="mt-4">
        {estado.tipo === 'carregando' && 'Carregando o histórico...'}
        {lista && resumo(lista.total)}
      </p>

      {estado.tipo === 'erro' && (
        <MensagemErro>
          Não foi possível carregar o histórico agora. Tente de novo em alguns
          minutos.
        </MensagemErro>
      )}

      {lista && lista.itens.length > 0 && (
        <>
          <Table responsive>
            <thead>
              <tr>
                <th scope="col">Data e hora</th>
                <th scope="col">Quem fez</th>
                <th scope="col">Ação</th>
                <th scope="col">Associado</th>
                <th scope="col">O que mudou</th>
              </tr>
            </thead>
            <tbody>
              {lista.itens.map((item) => (
                <tr key={item.id}>
                  <td className="text-nowrap">
                    {formatarDataHora(item.ocorridoEm)}
                  </td>
                  <td>{item.usuario.nome}</td>
                  <td>{textoAcaoAuditoria(item.acao)}</td>
                  <td>
                    {item.associado ? (
                      <>
                        <Link to={`/admin/associados/${item.associado.id}`}>
                          {item.associado.razaoSocial}
                        </Link>
                        <div className="text-body-secondary text-nowrap">
                          {formatarCnpj(item.associado.cnpj)}
                        </div>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    <Mudancas item={item} />
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>

          {totalPaginas > 1 && (
            <nav
              aria-label="Páginas do histórico"
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

/** Cada campo que mudou, com o valor de antes e o de depois. */
function Mudancas({ item }: { item: ItemLogAuditoria }) {
  const anterior = item.valorAnterior ?? {};
  const novo = item.valorNovo ?? {};
  const campos = [...new Set([...Object.keys(anterior), ...Object.keys(novo)])];
  if (campos.length === 0) return <>—</>;

  return (
    <ul className="list-unstyled mb-0">
      {campos.map((campo) => (
        <li key={campo}>
          <strong>{NOMES_CAMPOS[campo] ?? campo}:</strong>{' '}
          {campo in anterior ? (
            <>
              {textoValor(campo, anterior[campo])} →{' '}
              {textoValor(campo, novo[campo] ?? null)}
            </>
          ) : (
            textoValor(campo, novo[campo] ?? null)
          )}
        </li>
      ))}
    </ul>
  );
}

function textoValor(campo: string, valor: ValorCampoLog): string {
  if (campo === 'acessoManual') {
    if (valor === 'BLOQUEADO') return 'Bloqueado pela sede';
    if (valor === 'LIBERADO') return 'Liberado pela sede';
    return 'Segue o pagamento';
  }
  if (valor === null || valor === '') return 'vazio';
  if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não';
  if (typeof valor === 'string' && DATA_HORA_ISO.test(valor)) {
    return formatarDataHora(valor);
  }
  return String(valor);
}

/** Data e hora no horário de Mato Grosso, onde fica a sede. */
function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Cuiaba',
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

/** Filtros do endereço. Valores que a API não aceita são ignorados. */
function lerFiltros(parametros: URLSearchParams): FiltrosLogAuditoria {
  const pagina = Number(parametros.get('pagina'));
  const acao = parametros.get('acao') ?? '';
  const usuarioId = parametros.get('usuarioId') ?? '';
  const de = parametros.get('de') ?? '';
  const ate = parametros.get('ate') ?? '';
  return {
    usuarioId: UUID.test(usuarioId) ? usuarioId : undefined,
    associado: parametros.get('associado')?.trim() || undefined,
    acao: ehAcaoAuditoria(acao) ? acao : undefined,
    de: DIA.test(de) ? de : undefined,
    ate: DIA.test(ate) ? ate : undefined,
    pagina: Number.isInteger(pagina) && pagina > 1 ? pagina : undefined,
  };
}

function resumo(total: number): string {
  if (total === 0) return 'Nenhuma ação encontrada.';
  if (total === 1) return '1 ação encontrada.';
  return `${total} ações encontradas.`;
}
