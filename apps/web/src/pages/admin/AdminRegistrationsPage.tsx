import { useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Spinner } from "react-bootstrap";
import {
  approveAdminRegistration,
  AuthApiError,
  getAdminRegistrations,
  resendAdminRegistrationWelcome,
  type AdminRegistration,
} from "../../lib/auth";

function date(value: string | null) {
  if (!value) return "Data não informada";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatCnpj(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 14) return value;
  return digits.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    "$1.$2.$3/$4-$5",
  );
}

function AdminRegistrationsPage() {
  const [registrations, setRegistrations] = useState<AdminRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [noticeVariant, setNoticeVariant] = useState<"success" | "warning">(
    "success",
  );

  async function loadRegistrations() {
    setError("");
    try {
      setRegistrations(await getAdminRegistrations());
    } catch (loadError) {
      setError(
        loadError instanceof AuthApiError
          ? loadError.message
          : "Não foi possível carregar as solicitações de cadastro.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRegistrations();
    const intervalId = window.setInterval(() => {
      void loadRegistrations();
    }, 15_000);
    window.addEventListener("focus", loadRegistrations);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", loadRegistrations);
    };
  }, []);

  async function approveRegistration(registration: AdminRegistration) {
    setSavingId(registration.id);
    setError("");
    setNotice("");
    try {
      const result = await approveAdminRegistration(registration.id);
      setNotice(result.message);
      setNoticeVariant(result.welcomeEmailSent ? "success" : "warning");
      await loadRegistrations();
    } catch (actionError) {
      const message =
        actionError instanceof AuthApiError
          ? actionError.message
          : "Não foi possível aprovar este cadastro.";
      await loadRegistrations();
      setError(message);
    } finally {
      setSavingId("");
    }
  }

  async function resendWelcome(registration: AdminRegistration) {
    setSavingId(registration.id);
    setError("");
    setNotice("");
    try {
      const result = await resendAdminRegistrationWelcome(registration.id);
      setNotice(result.message);
      setNoticeVariant(result.welcomeEmailSent ? "success" : "warning");
      await loadRegistrations();
    } catch (actionError) {
      const message =
        actionError instanceof AuthApiError
          ? actionError.message
          : "Não foi possível enviar o e-mail de boas-vindas.";
      await loadRegistrations();
      setError(message);
    } finally {
      setSavingId("");
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-breadcrumb">SEDE PATRONAL / ACESSO DE USUÁRIOS</div>
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">GESTÃO DE CONTAS</p>
          <h1>Aprovação de cadastros</h1>
          <p>
            Confira os dados da farmácia antes de liberar o acesso do usuário.
          </p>
        </div>
        <Badge bg="primary">{registrations.length} aguardando ação</Badge>
      </div>

      {error && (
        <Alert variant="danger" role="alert">
          {error}
        </Alert>
      )}
      {notice && (
        <Alert variant={noticeVariant} role="status" aria-live="polite">
          {notice}
        </Alert>
      )}
      <Alert variant="info">
        Aprovar ativa o login da conta, mas não ativa a contribuição sindical.
        Contas ainda inadimplentes não recebem acesso a benefícios, documentos
        completos das convenções ou suporte.
      </Alert>

      <section
        className="admin-content-list"
        aria-label="Solicitações que precisam de aprovação ou reenvio do e-mail de boas-vindas"
      >
        {loading ? (
          <div className="admin-inline-loading">
            <Spinner animation="border" /> Carregando solicitações...
          </div>
        ) : registrations.length ? (
          registrations.map((registration) => {
            const pending =
              registration.registrationStatus === "PENDING_APPROVAL";
            return (
              <Card className="admin-content-item" key={registration.id}>
                <Card.Body>
                  <div className="admin-content-item-heading">
                    <h2>{registration.associate.legalName}</h2>
                    <Badge bg={pending ? "warning" : "secondary"}>
                      {pending
                        ? "Aguardando aprovação"
                        : "Aprovado · e-mail pendente"}
                    </Badge>
                  </div>
                  {registration.associate.tradeName && (
                    <p className="mb-1">
                      Nome fantasia: {registration.associate.tradeName}
                    </p>
                  )}
                  <p className="mb-1">
                    CNPJ: {formatCnpj(registration.associate.cnpj)}
                  </p>
                  <p className="mb-1">E-mail: {registration.email}</p>
                  <small>
                    Solicitação recebida:{" "}
                    {date(registration.registrationRequestedAt)}
                  </small>
                  {!pending && (
                    <small className="d-block">
                      Aprovado: {date(registration.registrationApprovedAt)}
                    </small>
                  )}
                  <div className="admin-item-actions">
                    {pending ? (
                      <Button
                        disabled={Boolean(savingId)}
                        onClick={() => void approveRegistration(registration)}
                      >
                        {savingId === registration.id
                          ? "Aprovando..."
                          : "Aprovar e enviar boas-vindas"}
                      </Button>
                    ) : (
                      <Button
                        variant="outline-primary"
                        disabled={Boolean(savingId)}
                        onClick={() => void resendWelcome(registration)}
                      >
                        {savingId === registration.id
                          ? "Enviando..."
                          : "Tentar envio do e-mail novamente"}
                      </Button>
                    )}
                  </div>
                </Card.Body>
              </Card>
            );
          })
        ) : (
          <Card className="admin-empty-card">
            <Card.Body>
              <h2>Nenhum cadastro aguardando ação</h2>
              <p>
                As farmácias cadastradas aparecerão aqui para aprovação. Se um
                e-mail de boas-vindas não for entregue, também ficará disponível
                aqui para reenvio.
              </p>
            </Card.Body>
          </Card>
        )}
      </section>
    </div>
  );
}

export default AdminRegistrationsPage;
