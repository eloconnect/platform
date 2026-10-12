import { useState, type FormEvent } from "react";
import { Alert, Button, Card, Container, Form } from "react-bootstrap";
import { Link } from "react-router-dom";
import Brand from "../components/Brand";
import { AuthApiError, register } from "../lib/auth";

function RegistrationPendingPage() {
  const [legalName, setLegalName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (password !== passwordConfirmation) {
      setError("As senhas informadas não são iguais.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await register({
        legalName,
        tradeName: tradeName || undefined,
        cnpj,
        email,
        password,
      });
      setPassword("");
      setPasswordConfirmation("");
      setIsSubmitted(true);
      setNotice(
        result?.message ??
          "Cadastro enviado para análise. Você receberá um e-mail após a aprovação.",
      );
    } catch (submissionError) {
      setError(
        submissionError instanceof AuthApiError
          ? submissionError.message
          : "Não foi possível enviar sua solicitação. Tente novamente.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-page recovery-page">
      <a className="skip-link" href="#registration-form">
        Ir para o formulário de cadastro
      </a>
      <Container className="login-container">
        <Card className="login-card recovery-card">
          <Card.Body>
            <div className="login-brand">
              <Brand />
            </div>
            <h1 className="recovery-title">Solicitar acesso</h1>
            <p className="login-intro recovery-intro">
              Envie os dados da farmácia. A conta só será liberada depois da
              análise e aprovação da equipe do sindicato.
            </p>

            {error && (
              <Alert variant="danger" role="alert">
                {error}
              </Alert>
            )}
            {isSubmitted ? (
              <>
                <Alert variant="success" role="status" aria-live="polite">
                  {notice}
                </Alert>
                <p className="registration-copy">
                  A farmácia já está na fila de aprovação administrativa. Quando
                  o cadastro for aprovado, enviaremos um e-mail de confirmação
                  para o endereço informado. A senha não será enviada por
                  e-mail.
                </p>
                <Link
                  className="btn btn-primary btn-lg w-100 recovery-action"
                  to="/login"
                >
                  Ir para entrar
                </Link>
              </>
            ) : (
              <Form id="registration-form" onSubmit={handleSubmit}>
                <Form.Group
                  className="mb-3"
                  controlId="registration-legal-name"
                >
                  <Form.Label>Razão social</Form.Label>
                  <Form.Control
                    required
                    minLength={3}
                    maxLength={180}
                    autoComplete="organization"
                    value={legalName}
                    onChange={(event) => setLegalName(event.target.value)}
                  />
                </Form.Group>
                <Form.Group
                  className="mb-3"
                  controlId="registration-trade-name"
                >
                  <Form.Label>Nome fantasia (opcional)</Form.Label>
                  <Form.Control
                    maxLength={180}
                    autoComplete="organization"
                    value={tradeName}
                    onChange={(event) => setTradeName(event.target.value)}
                  />
                </Form.Group>
                <Form.Group className="mb-3" controlId="registration-cnpj">
                  <Form.Label>CNPJ</Form.Label>
                  <Form.Control
                    required
                    minLength={14}
                    maxLength={18}
                    inputMode="numeric"
                    placeholder="00.000.000/0000-00"
                    value={cnpj}
                    onChange={(event) => setCnpj(event.target.value)}
                  />
                  <Form.Text>
                    O CNPJ é usado apenas como dado cadastral da farmácia.
                  </Form.Text>
                </Form.Group>
                <Form.Group className="mb-3" controlId="registration-email">
                  <Form.Label>
                    E-mail para acesso e avisos do cadastro
                  </Form.Label>
                  <Form.Control
                    required
                    type="email"
                    maxLength={254}
                    autoComplete="email"
                    inputMode="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </Form.Group>
                <Form.Group className="mb-3" controlId="registration-password">
                  <Form.Label>Crie uma senha</Form.Label>
                  <Form.Control
                    required
                    type="password"
                    minLength={8}
                    maxLength={72}
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <Form.Text>
                    Use pelo menos 8 caracteres. A senha não será compartilhada
                    com a equipe.
                  </Form.Text>
                </Form.Group>
                <Form.Group
                  className="mb-3"
                  controlId="registration-password-confirmation"
                >
                  <Form.Label>Confirme a senha</Form.Label>
                  <Form.Control
                    required
                    type="password"
                    minLength={8}
                    maxLength={72}
                    autoComplete="new-password"
                    value={passwordConfirmation}
                    onChange={(event) =>
                      setPasswordConfirmation(event.target.value)
                    }
                  />
                </Form.Group>
                <Alert variant="info" role="note">
                  Sua conta ficará inativa até a aprovação do administrador. A
                  aprovação libera o acesso à área do associado, mas não ativa
                  contribuição ou benefícios automaticamente.
                </Alert>
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-100 recovery-action"
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? "Enviando solicitação..."
                    : "Solicitar acesso"}
                </Button>
              </Form>
            )}
          </Card.Body>
        </Card>
        <Link className="back-link" to="/login">
          Já tem acesso? Entrar
        </Link>
      </Container>
    </main>
  );
}

export default RegistrationPendingPage;
