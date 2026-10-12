import { useEffect, useState, type FormEvent } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Form,
  Row,
  Spinner,
  Table,
} from "react-bootstrap";
import {
  AuthApiError,
  getAdminOverview,
  type AdminOverview,
} from "../../lib/auth";

const pageSize = 8;

function currency(amount: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(amount);
}

function date(value: string) {
  return new Intl.DateTimeFormat("pt-BR").format(
    new Date(`${value.slice(0, 10)}T12:00:00`),
  );
}

const associateStatus: Record<string, string> = {
  ADIMPLENTE: "Adimplente",
  INADIMPLENTE: "Inadimplente",
  CANCELAMENTO_SOLICITADO: "Desativação solicitada",
  CANCELADO: "Desativado",
};

function AdminDashboardPage() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    setLoading(true);
    setError("");
    getAdminOverview(params.toString())
      .then((result) => {
        if (mounted) setData(result);
      })
      .catch((requestError: unknown) => {
        if (!mounted) return;
        setError(
          requestError instanceof AuthApiError
            ? requestError.message
            : "Não foi possível carregar o painel administrativo.",
        );
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [page, search, status]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;
  const metrics = data?.metrics;

  return (
    <div className="admin-page">
      <div className="admin-breadcrumb">SEDE PATRONAL / VISÃO GERAL</div>
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">GESTÃO SINDICAL</p>
          <h1>Painel executivo</h1>
          <p>
            Acompanhe os associados e a situação das contribuições sindicais.
          </p>
        </div>
        <Badge bg="primary">Dados do cadastro</Badge>
      </div>

      {error && (
        <Alert variant="danger" role="alert">
          {error}
        </Alert>
      )}
      {metrics ? (
        <Row className="g-3 admin-metrics">
          <Col sm={6} xl={3}>
            <Card className="admin-metric-card">
              <Card.Body>
                <span>Total de associados</span>
                <strong>{metrics.totalAssociates}</strong>
                <small>Estabelecimentos cadastrados</small>
              </Card.Body>
            </Card>
          </Col>
          <Col sm={6} xl={3}>
            <Card className="admin-metric-card admin-metric-success">
              <Card.Body>
                <span>Adimplentes</span>
                <strong>{metrics.upToDateAssociates}</strong>
                <small>Com acesso aos serviços elegíveis</small>
              </Card.Body>
            </Card>
          </Col>
          <Col sm={6} xl={3}>
            <Card className="admin-metric-card admin-metric-warning">
              <Card.Body>
                <span>Inadimplentes</span>
                <strong>{metrics.overdueAssociates}</strong>
                <small>Sem acesso a benefícios e suporte</small>
              </Card.Body>
            </Card>
          </Col>
          <Col sm={6} xl={3}>
            <Card className="admin-metric-card admin-metric-neutral">
              <Card.Body>
                <span>Boletos em preparação</span>
                <strong>{metrics.draftBills}</strong>
                <small>Rascunhos aguardando revisão</small>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      ) : loading ? (
        <div className="admin-inline-loading">
          <Spinner animation="border" /> Carregando indicadores...
        </div>
      ) : null}

      <Card className="admin-integration-card">
        <Card.Body>
          <div>
            <p className="admin-eyebrow">COBRANÇA SINDICAL</p>
            <h2>Lote mensal de contribuições</h2>
            <p>
              {metrics?.pendingCancellations
                ? `${metrics.pendingCancellations} solicitação(ões) aguardam análise.`
                : "Acompanhe os associados com contribuição recorrente e a preparação dos boletos."}
            </p>
          </div>
          <div className="admin-integration-action">
            <Badge bg="warning" text="dark">
              Integração Sicredi não configurada
            </Badge>
            <Button
              disabled
              title="A emissão e o envio ainda não estão conectados ao Sicredi"
            >
              Disparar lote Sicredi
            </Button>
            <small>
              O sistema não emitirá nem enviará cobranças até a integração ser
              configurada.
            </small>
          </div>
        </Card.Body>
      </Card>

      <Card className="admin-table-card">
        <Card.Body>
          <div className="admin-table-heading">
            <div>
              <p className="admin-eyebrow">CADASTRO DA CATEGORIA</p>
              <h2>Associados</h2>
            </div>
            <Badge bg="light" text="primary">
              {data?.total ?? 0} encontrados
            </Badge>
          </div>
          <Form className="admin-filter-form" onSubmit={handleSearch}>
            <Form.Control
              aria-label="Buscar por razão social, nome fantasia ou CNPJ"
              placeholder="Buscar por razão social, nome fantasia ou CNPJ"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
            <Form.Select
              aria-label="Filtrar por situação"
              value={status}
              onChange={(event) => {
                setPage(1);
                setStatus(event.target.value);
              }}
            >
              <option value="">Todas as situações</option>
              <option value="ADIMPLENTE">Adimplente</option>
              <option value="INADIMPLENTE">Inadimplente</option>
              <option value="CANCELADO">Desativado</option>
            </Form.Select>
            <Button type="submit">Buscar</Button>
          </Form>
          {loading ? (
            <div className="admin-inline-loading">
              <Spinner animation="border" /> Carregando associados...
            </div>
          ) : (
            <div className="table-responsive">
              <Table hover className="admin-associates-table" responsive="md">
                <thead>
                  <tr>
                    <th>Estabelecimento / CNPJ</th>
                    <th>Situação</th>
                    <th>Contribuição mensal</th>
                    <th>Último boleto</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.associates.map((associate) => (
                    <tr key={associate.id}>
                      <td>
                        <strong>
                          {associate.tradeName || associate.legalName}
                        </strong>
                        <small>
                          {associate.legalName} · {associate.cnpj}
                        </small>
                      </td>
                      <td>
                        <Badge
                          bg={
                            associate.status === "ADIMPLENTE"
                              ? "success"
                              : associate.status === "INADIMPLENTE"
                                ? "warning"
                                : "secondary"
                          }
                          text={
                            associate.status === "INADIMPLENTE"
                              ? "dark"
                              : undefined
                          }
                        >
                          {associateStatus[associate.status] ??
                            associate.status}
                        </Badge>
                        {associate.manuallyBlocked && (
                          <small className="admin-row-note">
                            Bloqueio manual
                          </small>
                        )}
                      </td>
                      <td>
                        {associate.recurringBilling
                          ? "Ativa"
                          : "Não recebe mensalmente"}
                      </td>
                      <td>
                        {associate.lastBill ? (
                          <>
                            <strong>
                              {currency(associate.lastBill.amount)}
                            </strong>
                            <small>
                              {associate.lastBill.identifier} · vence{" "}
                              {date(associate.lastBill.dueDate)}
                            </small>
                          </>
                        ) : (
                          "Sem boleto registrado"
                        )}
                      </td>
                    </tr>
                  ))}
                  {!data?.associates.length && (
                    <tr>
                      <td colSpan={4} className="admin-empty-row">
                        Nenhum associado encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </div>
          )}
          <div className="admin-pagination">
            <span>
              {data?.total
                ? `Exibindo ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, data.total)} de ${data.total}`
                : "Nenhum registro"}
            </span>
            <div>
              <Button
                variant="outline-primary"
                disabled={page <= 1 || loading}
                onClick={() => setPage((current) => current - 1)}
              >
                Anterior
              </Button>
              <span>
                Página {page} de {totalPages}
              </span>
              <Button
                variant="outline-primary"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((current) => current + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
}

export default AdminDashboardPage;
