import { useState, type FormEvent } from 'react';
import { Alert, Button, Card, Container, Form } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import Brand from '../components/Brand';
import { AuthApiError, requestPasswordReset } from '../lib/auth';

function PasswordRecoveryPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');
    setIsSubmitting(true);
    try {
      const result = await requestPasswordReset(email);
      if (!result) {
        throw new Error('A API não confirmou a solicitação.');
      }
      setMessage(result.message);
    } catch (submissionError) {
      setError(
        submissionError instanceof AuthApiError
          ? submissionError.message
          : 'Não foi possível solicitar a recuperação. Tente novamente.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-page recovery-page">
      <a className="skip-link" href="#recovery-form">
        Ir para o formulário de recuperação
      </a>
      <Container className="login-container">
        <Card className="login-card recovery-card">
          <Card.Body>
            <div className="login-brand">
              <Brand />
            </div>
            <h1 className="recovery-title">Recuperar senha</h1>
            <p className="login-intro recovery-intro">
              Informe o e-mail cadastrado na sua conta. Vamos orientar você
              sobre o próximo passo.
            </p>

            {error && (
              <Alert variant="danger" className="recovery-notice" role="alert">
                {error}
              </Alert>
            )}
            {message && (
              <Alert
                variant="info"
                className="recovery-notice"
                role="status"
                aria-live="polite"
              >
                {message}
              </Alert>
            )}

            <Form id="recovery-form" tabIndex={-1} onSubmit={handleSubmit}>
              <Form.Group className="mb-4" controlId="recoveryEmail">
                <Form.Label>
                  E-mail cadastrado <span aria-hidden="true">*</span>
                </Form.Label>
                <Form.Control
                  type="email"
                  name="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="voce@exemplo.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </Form.Group>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-100 login-submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Enviando...' : 'Enviar instruções'}
              </Button>
            </Form>
          </Card.Body>
        </Card>
        <Link className="back-link" to="/login">
          Voltar para o acesso
        </Link>
      </Container>
    </main>
  );
}

export default PasswordRecoveryPage;
