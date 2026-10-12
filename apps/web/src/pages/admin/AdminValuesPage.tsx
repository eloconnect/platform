import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Form,
  Spinner,
  Table,
} from "react-bootstrap";
import {
  AuthApiError,
  decideContributionProposal,
  getAdminContributions,
  submitContributionProposal,
  type AdminContributions,
  type AdminContributionProposal,
} from "../../lib/auth";

const annualDiscountPercent = 20;

function currency(amount: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(amount);
}

function date(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(
    new Date(`${value.slice(0, 10)}T12:00:00`),
  );
}

function AdminValuesPage() {
  const [data, setData] = useState<AdminContributions | null>(null);
  const [annualAmount, setAnnualAmount] = useState("");
  const [note, setNote] = useState("");
  const [decisionNote, setDecisionNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadContributions() {
    setError("");
    try {
      const result = await getAdminContributions();
      setData(result);
      if (!annualAmount && result.current) {
        setAnnualAmount(String(result.current.annualAmount));
      }
    } catch (loadError) {
      setError(
        loadError instanceof AuthApiError
          ? loadError.message
          : "Não foi possível carregar os valores de contribuição.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadContributions();
  }, []);

  const annualValue = Number(annualAmount);
  const projectedMonthly =
    Number.isFinite(annualValue) && annualValue > 0
      ? Math.round(
          (annualValue / (1 - annualDiscountPercent / 100) / 12) * 100,
        ) / 100
      : 0;
  const nextYear = new Date().getFullYear() + 1;
  const pendingProposals = useMemo(
    () =>
      data?.proposals.filter(
        (proposal) => proposal.status === "PENDING_HOMOLOGATION",
      ) ?? [],
    [data],
  );
  const resolvedProposals = useMemo(
    () =>
      data?.proposals.filter(
        (proposal) => proposal.status !== "PENDING_HOMOLOGATION",
      ) ?? [],
    [data],
  );

  async function submitProposal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!Number.isFinite(annualValue) || annualValue <= 0) {
      setError("Informe um valor anual válido maior que zero.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const proposal = await submitContributionProposal(annualValue, note);
      setNotice(
        `Proposta registrada como pendente de homologação. O valor previsto de ${currency(proposal.monthlyAmount)} por mês terá vigência em ${date(proposal.effectiveFrom)} somente após homologação.`,
      );
      setNote("");
      await loadContributions();
    } catch (submitError) {
      setError(
        submitError instanceof AuthApiError
          ? submitError.message
          : "Não foi possível registrar a proposta de reajuste.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function recordDecision(
    proposal: AdminContributionProposal,
    decision: "APPROVED" | "REJECTED",
  ) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await decideContributionProposal(proposal.id, decision, decisionNote);
      setDecisionNote("");
      setNotice(
        decision === "APPROVED"
          ? "Homologação registrada. O novo valor foi agendado para a vigência prevista; o valor atual permanece até lá."
          : "A recusa da diretoria foi registrada; os valores vigentes não foram alterados.",
      );
      await loadContributions();
    } catch (decisionError) {
      setError(
        decisionError instanceof AuthApiError
          ? decisionError.message
          : "Não foi possível registrar a decisão da diretoria.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-breadcrumb">
        SEDE PATRONAL / GESTÃO FINANCEIRA / CONTRIBUIÇÕES
      </div>
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">VALORES DA CONTRIBUIÇÃO SINDICAL</p>
          <h1>Valores e reajustes</h1>
          <p>
            Defina a proposta anual, encaminhe à diretoria e acompanhe o
            histórico de vigências.
          </p>
        </div>
        <Badge bg="light" text="primary">
          Desconto anual: {annualDiscountPercent}%
        </Badge>
      </div>

      {error && (
        <Alert variant="danger" role="alert">
          {error}
        </Alert>
      )}
      {notice && (
        <Alert variant="success" role="status">
          {notice}
        </Alert>
      )}

      <section className="admin-values-summary" aria-label="Valores atuais">
        <Card className="admin-value-card">
          <Card.Body>
            <p className="admin-eyebrow">CONTRIBUIÇÃO MENSAL ATUAL</p>
            {data?.current ? (
              <>
                <strong>
                  {currency(data.current.monthlyAmount)} <small>/ mês</small>
                </strong>
                <span>Vigente desde {date(data.current.effectiveFrom)}</span>
              </>
            ) : (
              <span>Valor ainda não cadastrado.</span>
            )}
          </Card.Body>
        </Card>
        <Card className="admin-value-card admin-value-card-accent">
          <Card.Body>
            <p className="admin-eyebrow">PLANO ANUAL VIGENTE</p>
            {data?.current ? (
              <>
                <strong>
                  {currency(data.current.annualAmount)} <small>/ ano</small>
                </strong>
                <span>Pagamento anual à vista com desconto de 20%.</span>
              </>
            ) : (
              <span>Valor ainda não cadastrado.</span>
            )}
          </Card.Body>
        </Card>
        <Card className="admin-value-card">
          <Card.Body>
            <p className="admin-eyebrow">PRÓXIMA VIGÊNCIA</p>
            <strong>01/01/{nextYear}</strong>
            <span>O reajuste anual só pode valer no próximo ano.</span>
          </Card.Body>
        </Card>
      </section>

      <Card className="admin-form-card admin-proposal-card">
        <Card.Body>
          <div className="admin-proposal-heading">
            <div>
              <p className="admin-eyebrow">PROPOSTA DE REAJUSTE ANUAL</p>
              <h2>Propor novo valor da contribuição</h2>
              <p>
                Informe o valor anual à vista escolhido pela administração. O
                sistema calcula o valor mensal equivalente considerando o
                desconto anual de 20%.
              </p>
            </div>
            <Badge bg="primary">Vigência a partir de 01/01/{nextYear}</Badge>
          </div>
          <Form onSubmit={submitProposal}>
            <div className="admin-proposal-fields">
              <Form.Group controlId="proposal-annual-amount">
                <Form.Label>Novo valor anual à vista (R$)</Form.Label>
                <Form.Control
                  type="number"
                  min="0.01"
                  max="1000000"
                  step="0.01"
                  inputMode="decimal"
                  required
                  value={annualAmount}
                  onChange={(event) => setAnnualAmount(event.target.value)}
                />
                <Form.Text>
                  Valor anual final, já com o desconto aplicado.
                </Form.Text>
              </Form.Group>
              <Form.Group controlId="proposal-monthly-projection">
                <Form.Label>Valor mensal equivalente</Form.Label>
                <Form.Control
                  readOnly
                  value={
                    projectedMonthly
                      ? currency(projectedMonthly)
                      : "Informe o valor anual"
                  }
                />
                <Form.Text>Cálculo: valor anual ÷ 0,8 ÷ 12.</Form.Text>
              </Form.Group>
              <Form.Group controlId="proposal-annual-discount">
                <Form.Label>Desconto anual</Form.Label>
                <Form.Control readOnly value={`${annualDiscountPercent}%`} />
                <Form.Text>Percentual definido para o plano anual.</Form.Text>
              </Form.Group>
            </div>
            <Form.Group className="mt-3" controlId="proposal-note">
              <Form.Label>
                Justificativa ou observação para a diretoria
              </Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                maxLength={1000}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Registre a base usada para a proposta."
              />
            </Form.Group>
            <Alert variant="info" className="mt-3">
              A proposta ficará registrada aqui como pendente; esta aplicação
              ainda não envia e-mail nem notificação à diretoria. Encaminhe-a
              pelo canal oficial da sede. Ela não altera os boletos nem o valor
              vigente. Após homologação, a vigência ficará agendada para 1º de
              janeiro do próximo ano.
            </Alert>
            <div className="admin-form-actions">
              <Button type="submit" disabled={saving || !projectedMonthly}>
                {saving
                  ? "Salvando proposta..."
                  : "Salvar proposta pendente de homologação"}
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>

      <section
        className="admin-proposals-section"
        aria-labelledby="pending-proposals-title"
      >
        <div className="admin-list-heading">
          <div>
            <p className="admin-eyebrow">AGUARDANDO RETORNO</p>
            <h2 id="pending-proposals-title">Propostas para homologação</h2>
          </div>
          <Badge bg="warning" text="dark">
            {pendingProposals.length} pendentes
          </Badge>
        </div>
        {loading ? (
          <div className="admin-inline-loading">
            <Spinner animation="border" /> Carregando valores...
          </div>
        ) : pendingProposals.length ? (
          pendingProposals.map((proposal) => (
            <Card className="admin-proposal-record" key={proposal.id}>
              <Card.Body>
                <div>
                  <Badge bg="warning" text="dark">
                    Aguardando homologação
                  </Badge>
                  <h3>
                    {currency(proposal.annualAmount)} ao ano ·{" "}
                    {currency(proposal.monthlyAmount)} por mês
                  </h3>
                  <p>
                    Enviada por {proposal.submittedBy} em{" "}
                    {date(proposal.submittedAt)}. Vigência prevista:{" "}
                    {date(proposal.effectiveFrom)}.
                  </p>
                  {proposal.note && <p>Justificativa: {proposal.note}</p>}
                </div>
                <div className="admin-proposal-decision">
                  <Form.Control
                    aria-label="Observação do retorno da diretoria"
                    placeholder="Observação do retorno (opcional)"
                    value={decisionNote}
                    onChange={(event) => setDecisionNote(event.target.value)}
                    maxLength={500}
                  />
                  <Button
                    disabled={saving}
                    onClick={() => void recordDecision(proposal, "APPROVED")}
                  >
                    Registrar homologação
                  </Button>
                  <Button
                    variant="outline-danger"
                    disabled={saving}
                    onClick={() => void recordDecision(proposal, "REJECTED")}
                  >
                    Registrar recusa
                  </Button>
                </div>
              </Card.Body>
              <Card.Footer>
                Registre uma decisão somente após receber o retorno oficial da
                diretoria. Uma homologação não altera valores antes da data de
                vigência.
              </Card.Footer>
            </Card>
          ))
        ) : (
          <Card className="admin-empty-card">
            <Card.Body>Não há propostas aguardando homologação.</Card.Body>
          </Card>
        )}
      </section>

      <section
        className="admin-proposals-section"
        aria-labelledby="resolved-proposals-title"
      >
        <div className="admin-list-heading">
          <div>
            <p className="admin-eyebrow">DECISÕES REGISTRADAS</p>
            <h2 id="resolved-proposals-title">Homologações anteriores</h2>
          </div>
        </div>
        {resolvedProposals.length ? (
          resolvedProposals.map((proposal) => (
            <Card className="admin-proposal-record" key={proposal.id}>
              <Card.Body>
                <div>
                  <Badge
                    bg={
                      proposal.status === "APPROVED" ? "success" : "secondary"
                    }
                  >
                    {proposal.status === "APPROVED" ? "Homologada" : "Recusada"}
                  </Badge>
                  <h3>
                    {currency(proposal.annualAmount)} ao ano ·{" "}
                    {currency(proposal.monthlyAmount)} por mês
                  </h3>
                  <p>
                    Vigência prevista: {date(proposal.effectiveFrom)}. Retorno
                    registrado por {proposal.reviewedBy ?? "administrador"} em{" "}
                    {proposal.reviewedAt
                      ? date(proposal.reviewedAt)
                      : "data não informada"}
                    .
                  </p>
                  {proposal.decisionNote && (
                    <p>Observação da decisão: {proposal.decisionNote}</p>
                  )}
                </div>
                <p>
                  Proposta inicial:{" "}
                  {proposal.note || "Sem observação registrada."}
                </p>
              </Card.Body>
            </Card>
          ))
        ) : (
          <Card className="admin-empty-card">
            <Card.Body>Nenhuma proposta teve decisão registrada.</Card.Body>
          </Card>
        )}
      </section>

      <Card className="admin-table-card">
        <Card.Body>
          <div className="admin-list-heading">
            <div>
              <p className="admin-eyebrow">HISTÓRICO APPEND-ONLY</p>
              <h2>Valores já vigentes</h2>
            </div>
          </div>
          {loading ? (
            <div className="admin-inline-loading">
              <Spinner animation="border" /> Carregando histórico...
            </div>
          ) : data?.history.length ? (
            <div className="table-responsive">
              <Table hover className="admin-history-table">
                <thead>
                  <tr>
                    <th>Vigência</th>
                    <th>Valor mensal</th>
                    <th>Valor anual à vista</th>
                    <th>Registrado em</th>
                  </tr>
                </thead>
                <tbody>
                  {data.history.map((value) => (
                    <tr key={value.id}>
                      <td>{date(value.effectiveFrom)}</td>
                      <td>{currency(value.monthlyAmount)}</td>
                      <td>{currency(value.annualAmount)}</td>
                      <td>{date(value.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          ) : (
            <p className="admin-empty-copy">Nenhum valor foi registrado.</p>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}

export default AdminValuesPage;
