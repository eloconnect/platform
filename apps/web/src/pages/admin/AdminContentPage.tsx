import { useEffect, useState, type FormEvent } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Form,
  Spinner,
  Tab,
  Tabs,
} from "react-bootstrap";
import {
  AuthApiError,
  getAdminBenefits,
  getAdminConventions,
  saveAdminBenefit,
  saveAdminConvention,
  type AdminBenefit,
  type AdminConvention,
} from "../../lib/auth";

type ConventionForm = {
  title: string;
  summary: string;
  effectiveFrom: string;
  effectiveUntil: string;
  attachmentFileName: string;
  attachmentUrl: string;
};

type SalaryScaleForm = {
  jobTitle: string;
  floorAmount: string;
};

const emptyConvention: ConventionForm = {
  title: "",
  summary: "",
  effectiveFrom: "",
  effectiveUntil: "",
  attachmentFileName: "",
  attachmentUrl: "",
};

function dateInput(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

function dateLabel(value: string | null) {
  if (!value) return "Vigência não informada";
  return new Intl.DateTimeFormat("pt-BR").format(
    new Date(`${value.slice(0, 10)}T12:00:00`),
  );
}

function AdminContentPage() {
  const [conventions, setConventions] = useState<AdminConvention[]>([]);
  const [benefits, setBenefits] = useState<AdminBenefit[]>([]);
  const [conventionForm, setConventionForm] =
    useState<ConventionForm>(emptyConvention);
  const [salaryScales, setSalaryScales] = useState<SalaryScaleForm[]>([]);
  const [editingConventionId, setEditingConventionId] = useState("");
  const [editingConventionPublished, setEditingConventionPublished] =
    useState(false);
  const [benefitTitle, setBenefitTitle] = useState("");
  const [benefitDescription, setBenefitDescription] = useState("");
  const [editingBenefitId, setEditingBenefitId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadContent() {
    setError("");
    try {
      const [conventionData, benefitData] = await Promise.all([
        getAdminConventions(),
        getAdminBenefits(),
      ]);
      setConventions(conventionData);
      setBenefits(benefitData);
    } catch (loadError) {
      setError(
        loadError instanceof AuthApiError
          ? loadError.message
          : "Não foi possível carregar convenções e benefícios.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadContent();
  }, []);

  function editConvention(convention: AdminConvention) {
    setEditingConventionId(convention.id);
    setEditingConventionPublished(Boolean(convention.publishedAt));
    setConventionForm({
      title: convention.title,
      summary: convention.summary,
      effectiveFrom: dateInput(convention.effectiveFrom),
      effectiveUntil: dateInput(convention.effectiveUntil),
      attachmentFileName: "",
      attachmentUrl: "",
    });
    setSalaryScales(
      convention.salaryScales.map((salaryScale) => ({
        jobTitle: salaryScale.jobTitle,
        floorAmount: String(salaryScale.floorAmount),
      })),
    );
    setNotice("Editando convenção. Os anexos existentes serão preservados.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetConventionForm() {
    setEditingConventionId("");
    setEditingConventionPublished(false);
    setConventionForm(emptyConvention);
    setSalaryScales([]);
  }

  async function submitConvention(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const wasPublished = editingConventionPublished;
      await saveAdminConvention(
        {
          title: conventionForm.title,
          summary: conventionForm.summary,
          effectiveFrom: conventionForm.effectiveFrom || null,
          effectiveUntil: conventionForm.effectiveUntil || null,
          attachmentFileName: conventionForm.attachmentFileName || undefined,
          attachmentUrl: conventionForm.attachmentUrl || undefined,
          published: editingConventionId ? editingConventionPublished : false,
          salaryScales: salaryScales.map((salaryScale) => ({
            jobTitle: salaryScale.jobTitle,
            floorAmount: Number(salaryScale.floorAmount),
          })),
        },
        editingConventionId || undefined,
      );
      resetConventionForm();
      setNotice(
        wasPublished
          ? "Convenção atualizada e mantida publicada."
          : "Convenção salva como rascunho. Publique-a após revisar os dados.",
      );
      await loadContent();
    } catch (saveError) {
      setError(
        saveError instanceof AuthApiError
          ? saveError.message
          : "Não foi possível salvar a convenção.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleConventionPublication(convention: AdminConvention) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await saveAdminConvention(
        {
          title: convention.title,
          summary: convention.summary,
          effectiveFrom: convention.effectiveFrom ?? null,
          effectiveUntil: convention.effectiveUntil ?? null,
          published: !convention.publishedAt,
          salaryScales: convention.salaryScales.map((salaryScale) => ({
            jobTitle: salaryScale.jobTitle,
            floorAmount: salaryScale.floorAmount,
          })),
        },
        convention.id,
      );
      setNotice(
        convention.publishedAt
          ? "A convenção foi retirada da área dos associados."
          : "A convenção foi publicada para os associados.",
      );
      await loadContent();
    } catch (saveError) {
      setError(
        saveError instanceof AuthApiError
          ? saveError.message
          : "Não foi possível alterar a publicação.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function submitBenefit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await saveAdminBenefit(
        {
          title: benefitTitle,
          description: benefitDescription,
        },
        editingBenefitId || undefined,
      );
      setBenefitTitle("");
      setBenefitDescription("");
      setEditingBenefitId("");
      setNotice("Benefício salvo para associados adimplentes.");
      await loadContent();
    } catch (saveError) {
      setError(
        saveError instanceof AuthApiError
          ? saveError.message
          : "Não foi possível salvar o benefício.",
      );
    } finally {
      setSaving(false);
    }
  }

  function editBenefit(benefit: AdminBenefit) {
    setEditingBenefitId(benefit.id);
    setBenefitTitle(benefit.title);
    setBenefitDescription(benefit.description);
    setNotice("Editando benefício.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function toggleBenefit(benefit: AdminBenefit) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await saveAdminBenefit({ isActive: !benefit.isActive }, benefit.id);
      setNotice(
        benefit.isActive
          ? "Benefício desativado; ele não será exibido aos associados."
          : "Benefício ativado e disponível para associados elegíveis.",
      );
      await loadContent();
    } catch (saveError) {
      setError(
        saveError instanceof AuthApiError
          ? saveError.message
          : "Não foi possível alterar o benefício.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-breadcrumb">
        SEDE PATRONAL / CONTEÚDO INSTITUCIONAL
      </div>
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">GESTÃO JURÍDICA E SINDICAL</p>
          <h1>Convenções coletivas e benefícios</h1>
          <p>Gerencie os conteúdos publicados para as farmácias associadas.</p>
        </div>
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

      <Tabs defaultActiveKey="conventions" className="admin-content-tabs">
        <Tab eventKey="conventions" title="Convenções coletivas">
          <div className="admin-content-grid">
            <Card className="admin-form-card">
              <Card.Body>
                <p className="admin-eyebrow">
                  {editingConventionId ? "EDITAR CONTEÚDO" : "NOVA PUBLICAÇÃO"}
                </p>
                <h2>
                  {editingConventionId
                    ? "Editar convenção coletiva"
                    : "Cadastrar convenção coletiva"}
                </h2>
                <Form onSubmit={submitConvention}>
                  <Form.Group className="mb-3" controlId="convention-title">
                    <Form.Label>Título oficial</Form.Label>
                    <Form.Control
                      required
                      maxLength={180}
                      value={conventionForm.title}
                      onChange={(event) =>
                        setConventionForm({
                          ...conventionForm,
                          title: event.target.value,
                        })
                      }
                    />
                  </Form.Group>
                  <Form.Group className="mb-3" controlId="convention-summary">
                    <Form.Label>Resumo para associados</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={4}
                      required
                      maxLength={10000}
                      value={conventionForm.summary}
                      onChange={(event) =>
                        setConventionForm({
                          ...conventionForm,
                          summary: event.target.value,
                        })
                      }
                    />
                  </Form.Group>
                  <div className="admin-date-fields">
                    <Form.Group className="mb-3" controlId="convention-start">
                      <Form.Label>Início da vigência</Form.Label>
                      <Form.Control
                        type="date"
                        value={conventionForm.effectiveFrom}
                        onChange={(event) =>
                          setConventionForm({
                            ...conventionForm,
                            effectiveFrom: event.target.value,
                          })
                        }
                      />
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="convention-end">
                      <Form.Label>Fim da vigência</Form.Label>
                      <Form.Control
                        type="date"
                        value={conventionForm.effectiveUntil}
                        onChange={(event) =>
                          setConventionForm({
                            ...conventionForm,
                            effectiveUntil: event.target.value,
                          })
                        }
                      />
                    </Form.Group>
                  </div>
                  <div className="admin-salary-heading">
                    <div>
                      <Form.Label className="mb-1">
                        Tabela de pisos salariais
                      </Form.Label>
                      <p className="admin-form-help">
                        Informe os cargos e valores oficiais previstos nesta
                        convenção.
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline-primary"
                      onClick={() =>
                        setSalaryScales([
                          ...salaryScales,
                          { jobTitle: "", floorAmount: "" },
                        ])
                      }
                    >
                      Adicionar cargo
                    </Button>
                  </div>
                  {salaryScales.map((salaryScale, index) => (
                    <div className="admin-salary-scale-row" key={index}>
                      <Form.Group
                        className="mb-3"
                        controlId={`salary-job-${index}`}
                      >
                        <Form.Label>Cargo ou função</Form.Label>
                        <Form.Control
                          required
                          minLength={2}
                          maxLength={120}
                          value={salaryScale.jobTitle}
                          onChange={(event) =>
                            setSalaryScales(
                              salaryScales.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, jobTitle: event.target.value }
                                  : item,
                              ),
                            )
                          }
                        />
                      </Form.Group>
                      <Form.Group
                        className="mb-3"
                        controlId={`salary-floor-${index}`}
                      >
                        <Form.Label>Piso salarial mensal (R$)</Form.Label>
                        <Form.Control
                          type="number"
                          required
                          min="0.01"
                          max="99999999"
                          step="0.01"
                          value={salaryScale.floorAmount}
                          onChange={(event) =>
                            setSalaryScales(
                              salaryScales.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, floorAmount: event.target.value }
                                  : item,
                              ),
                            )
                          }
                        />
                      </Form.Group>
                      <Button
                        type="button"
                        variant="outline-danger"
                        size="sm"
                        aria-label={`Remover cargo ${salaryScale.jobTitle || index + 1}`}
                        onClick={() =>
                          setSalaryScales(
                            salaryScales.filter(
                              (_, itemIndex) => itemIndex !== index,
                            ),
                          )
                        }
                      >
                        Remover
                      </Button>
                    </div>
                  ))}
                  <div className="admin-document-fields">
                    <Form.Group
                      className="mb-3"
                      controlId="convention-file-name"
                    >
                      <Form.Label>Nome do documento PDF</Form.Label>
                      <Form.Control
                        placeholder="Convencao-coletiva-2026.pdf"
                        value={conventionForm.attachmentFileName}
                        onChange={(event) =>
                          setConventionForm({
                            ...conventionForm,
                            attachmentFileName: event.target.value,
                          })
                        }
                      />
                    </Form.Group>
                    <Form.Group
                      className="mb-3"
                      controlId="convention-file-url"
                    >
                      <Form.Label>Link seguro para o PDF</Form.Label>
                      <Form.Control
                        type="url"
                        placeholder="https://..."
                        value={conventionForm.attachmentUrl}
                        onChange={(event) =>
                          setConventionForm({
                            ...conventionForm,
                            attachmentUrl: event.target.value,
                          })
                        }
                      />
                    </Form.Group>
                  </div>
                  <Alert variant="info">
                    O arquivo não é enviado ao sistema. Informe um link HTTPS já
                    hospedado e autorizado pelo sindicato.
                  </Alert>
                  <div className="admin-form-actions">
                    {editingConventionId && (
                      <Button
                        variant="outline-secondary"
                        type="button"
                        onClick={resetConventionForm}
                      >
                        Cancelar edição
                      </Button>
                    )}
                    <Button type="submit" disabled={saving}>
                      {saving
                        ? "Salvando..."
                        : editingConventionId
                          ? "Salvar alterações"
                          : "Salvar rascunho"}
                    </Button>
                  </div>
                </Form>
              </Card.Body>
            </Card>
            <section
              className="admin-content-list"
              aria-labelledby="conventions-list-title"
            >
              <div className="admin-list-heading">
                <div>
                  <p className="admin-eyebrow">CONTEÚDO CADASTRADO</p>
                  <h2 id="conventions-list-title">Convenções</h2>
                </div>
                <Badge bg="light" text="primary">
                  {conventions.length}
                </Badge>
              </div>
              {loading ? (
                <div className="admin-inline-loading">
                  <Spinner animation="border" /> Carregando...
                </div>
              ) : conventions.length ? (
                conventions.map((convention) => (
                  <Card className="admin-content-item" key={convention.id}>
                    <Card.Body>
                      <div className="admin-content-item-heading">
                        <h3>{convention.title}</h3>
                        <Badge
                          bg={convention.publishedAt ? "success" : "secondary"}
                        >
                          {convention.publishedAt ? "Publicada" : "Rascunho"}
                        </Badge>
                      </div>
                      <p>{convention.summary}</p>
                      <small>
                        Vigência: {dateLabel(convention.effectiveFrom)} –{" "}
                        {dateLabel(convention.effectiveUntil)}
                      </small>
                      {convention.salaryScales.length > 0 && (
                        <div className="admin-salary-list">
                          <strong>Pisos salariais cadastrados</strong>
                          {convention.salaryScales.map((salaryScale) => (
                            <span key={salaryScale.id}>
                              {salaryScale.jobTitle}:{" "}
                              {new Intl.NumberFormat("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              }).format(salaryScale.floorAmount)}
                            </span>
                          ))}
                        </div>
                      )}
                      {convention.attachments.map((attachment) => (
                        <a
                          className="admin-attachment-link"
                          href={attachment.url}
                          target="_blank"
                          rel="noreferrer"
                          key={attachment.id}
                        >
                          Documento: {attachment.fileName}
                        </a>
                      ))}
                      <div className="admin-item-actions">
                        <Button
                          variant="outline-primary"
                          size="sm"
                          disabled={saving}
                          onClick={() => editConvention(convention)}
                        >
                          Editar
                        </Button>
                        <Button
                          variant={
                            convention.publishedAt
                              ? "outline-secondary"
                              : "primary"
                          }
                          size="sm"
                          disabled={saving}
                          onClick={() =>
                            void toggleConventionPublication(convention)
                          }
                        >
                          {convention.publishedAt
                            ? "Retirar publicação"
                            : "Publicar"}
                        </Button>
                      </div>
                    </Card.Body>
                  </Card>
                ))
              ) : (
                <Card className="admin-empty-card">
                  <Card.Body>Nenhuma convenção cadastrada.</Card.Body>
                </Card>
              )}
            </section>
          </div>
        </Tab>
        <Tab eventKey="benefits" title="Benefícios">
          <div className="admin-content-grid">
            <Card className="admin-form-card">
              <Card.Body>
                <p className="admin-eyebrow">CADASTRAR SERVIÇO</p>
                <h2>
                  {editingBenefitId
                    ? "Editar benefício sindical"
                    : "Novo benefício sindical"}
                </h2>
                <Form onSubmit={submitBenefit}>
                  <Form.Group className="mb-3" controlId="benefit-title">
                    <Form.Label>Nome do benefício</Form.Label>
                    <Form.Control
                      required
                      minLength={3}
                      maxLength={180}
                      value={benefitTitle}
                      onChange={(event) => setBenefitTitle(event.target.value)}
                    />
                  </Form.Group>
                  <Form.Group className="mb-3" controlId="benefit-description">
                    <Form.Label>Descrição</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={5}
                      required
                      minLength={5}
                      maxLength={5000}
                      value={benefitDescription}
                      onChange={(event) =>
                        setBenefitDescription(event.target.value)
                      }
                    />
                  </Form.Group>
                  <p className="admin-form-help">
                    Benefícios ativos são exibidos somente a associados
                    adimplentes sem bloqueio manual.
                  </p>
                  <div className="admin-form-actions">
                    {editingBenefitId && (
                      <Button
                        variant="outline-secondary"
                        type="button"
                        onClick={() => {
                          setEditingBenefitId("");
                          setBenefitTitle("");
                          setBenefitDescription("");
                        }}
                      >
                        Cancelar edição
                      </Button>
                    )}
                    <Button type="submit" disabled={saving}>
                      {saving
                        ? "Salvando..."
                        : editingBenefitId
                          ? "Salvar alterações"
                          : "Cadastrar benefício"}
                    </Button>
                  </div>
                </Form>
              </Card.Body>
            </Card>
            <section
              className="admin-content-list"
              aria-labelledby="benefits-list-title"
            >
              <div className="admin-list-heading">
                <div>
                  <p className="admin-eyebrow">CATÁLOGO DA SEDE</p>
                  <h2 id="benefits-list-title">Benefícios cadastrados</h2>
                </div>
                <Badge bg="light" text="primary">
                  {benefits.length}
                </Badge>
              </div>
              {loading ? (
                <div className="admin-inline-loading">
                  <Spinner animation="border" /> Carregando...
                </div>
              ) : benefits.length ? (
                benefits.map((benefit) => (
                  <Card className="admin-content-item" key={benefit.id}>
                    <Card.Body>
                      <div className="admin-content-item-heading">
                        <h3>{benefit.title}</h3>
                        <Badge bg={benefit.isActive ? "success" : "secondary"}>
                          {benefit.isActive ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                      <p>{benefit.description}</p>
                      <div className="admin-item-actions">
                        <Button
                          variant="outline-primary"
                          size="sm"
                          disabled={saving}
                          onClick={() => editBenefit(benefit)}
                        >
                          Editar
                        </Button>
                        <Button
                          variant={
                            benefit.isActive ? "outline-danger" : "primary"
                          }
                          size="sm"
                          disabled={saving}
                          onClick={() => void toggleBenefit(benefit)}
                        >
                          {benefit.isActive
                            ? "Desativar benefício"
                            : "Ativar benefício"}
                        </Button>
                      </div>
                    </Card.Body>
                  </Card>
                ))
              ) : (
                <Card className="admin-empty-card">
                  <Card.Body>Nenhum benefício cadastrado.</Card.Body>
                </Card>
              )}
            </section>
          </div>
        </Tab>
      </Tabs>
    </div>
  );
}

export default AdminContentPage;
