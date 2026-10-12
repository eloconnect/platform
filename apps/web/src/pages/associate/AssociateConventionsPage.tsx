import { useEffect, useState } from "react";
import { Alert, Badge, Card, Spinner } from "react-bootstrap";
import {
  AuthApiError,
  getMemberConventions,
  type MemberConvention,
} from "../../lib/auth";
import { useAssociatePortal } from "./AssociatePortalLayout";

function date(value: string | null) {
  if (!value) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(
    new Date(`${value.slice(0, 10)}T12:00:00`),
  );
}

function AssociateConventionsPage() {
  const { overview } = useAssociatePortal();
  const [conventions, setConventions] = useState<MemberConvention[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    getMemberConventions()
      .then((result) => {
        if (mounted) setConventions(result);
      })
      .catch((requestError: unknown) => {
        if (!mounted) return;
        setError(
          requestError instanceof AuthApiError
            ? requestError.message
            : "Não foi possível carregar as convenções coletivas.",
        );
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="portal-page">
      <div className="portal-page-heading">
        <div>
          <p className="portal-kicker">
            DOCUMENTOS TRABALHISTAS E EVENTOS OFICIAIS
          </p>
          <h1>Convenções coletivas de trabalho</h1>
          <p>
            {overview.access.conventionDocuments
              ? "Consulte documentos e vigências publicados para sua categoria."
              : "Consulte as informações gerais das convenções coletivas."}
          </p>
        </div>
      </div>
      {error && (
        <Alert variant="danger" role="alert">
          {error}
        </Alert>
      )}
      {loading ? (
        <div className="portal-inline-loading">
          <Spinner animation="border" />
          Carregando convenções...
        </div>
      ) : conventions.length ? (
        <div className="portal-conventions-list">
          {conventions.map((convention) => (
            <Card className="portal-convention-card" key={convention.id}>
              <Card.Body>
                <div className="portal-convention-heading">
                  <div>
                    <p className="portal-kicker">ACORDO COLETIVO</p>
                    <h2>{convention.title}</h2>
                  </div>
                  <Badge bg="light" text="primary">
                    {date(convention.effectiveFrom)} –{" "}
                    {date(convention.effectiveUntil)}
                  </Badge>
                </div>
                <p>{convention.summary}</p>
                {convention.salaryScales.length > 0 && (
                  <div className="portal-salary-scales">
                    <h3>Pisos salariais</h3>
                    <ul>
                      {convention.salaryScales.map((salaryScale) => (
                        <li key={salaryScale.id}>
                          <span>{salaryScale.jobTitle}</span>
                          <strong>
                            {new Intl.NumberFormat("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            }).format(salaryScale.floorAmount)}
                          </strong>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {convention.attachments.length > 0 ? (
                  <div className="portal-attachments">
                    {convention.attachments.map((attachment) => (
                      <a
                        key={attachment.id}
                        className="btn btn-primary"
                        href={attachment.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Baixar {attachment.fileName}
                      </a>
                    ))}
                  </div>
                ) : (
                  <Alert variant="info">
                    {overview.access.conventionDocuments
                      ? "O documento completo ainda não foi anexado."
                      : "O acesso aos documentos completos é exclusivo para associados adimplentes sem bloqueio manual."}
                  </Alert>
                )}
              </Card.Body>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="portal-empty-card">
          <Card.Body>
            <h2>Nenhuma convenção publicada</h2>
            <p>
              As convenções e os arquivos oficiais aparecerão aqui após
              publicação pelo sindicato.
            </p>
          </Card.Body>
        </Card>
      )}
    </div>
  );
}

export default AssociateConventionsPage;
