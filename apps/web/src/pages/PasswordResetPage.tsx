import { useState, type FormEvent } from 'react';
import { Alert, Button, Card, Container, Form } from 'react-bootstrap';
import { Link, useSearchParams } from 'react-router-dom';
import Brand from '../components/Brand';
import { AuthApiError, resetPassword } from '../lib/auth';

function PasswordResetPage() {
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);
  const hasResetToken = Boolean(searchParams.get('token')?.trim());

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password !== confirmation) {
      setError('As senhas não são iguais. Confira os dois campos.');
      setNotice('');
      return;
    }

    setError('');
    setNotice('');
    setIsSubmitting(true);
    try {
      await resetPassword(searchParams.get('token')!.trim(), password);
      setResetComplete(true);
      setNotice(
        'Senha redefinida. Agora você já pode entrar com a nova senha.',
      );
    } catch (submissionError) {
      setError(
        submissionError instanceof AuthApiError
          ? submissionError.message
          : 'Não foi possível redefinir a senha. Solicite um novo link e tente novamente.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-page recovery-page">
      <a className="skip-link" href="#reset-content">
        Ir para o formulário de nova senha
      </a>
      <Container className="login-container">
        <Card className="login-card recovery-card">
          <Card.Body id="reset-content" tabIndex={-1}>
            <div className="login-brand">
              <Brand />
            </div>
            <h1 className="recovery-title">Criar nova senha</h1>
            {hasResetToken ? (
              <>
                <p className="login-intro recovery-intro">
                  Escolha uma nova senha para acessar sua conta.
                </p>

                {resetComplete && (
                  <>
                    <Alert
                      variant="success"
                      className="recovery-notice"
                      role="status"
                      aria-live="polite"
                    >
                      {notice}
                    </Alert>
                    <Link
                      className="btn btn-primary btn-lg w-100 recovery-action"
                      to="/login"
                    >
                      Ir para o acesso
                    </Link>
                  </>
                )}

                {!resetComplete && (
                  <>
                    {error && (
                      <Alert
                        variant="danger"
                        className="recovery-notice"
                        role="alert"
                      >
                        {error}
                      </Alert>
                    )}
                    <Form tabIndex={-1} onSubmit={handleSubmit}>
                      <Form.Group className="mb-3" controlId="newPassword">
                        <div className="password-label-row">
                          <Form.Label>
                            Nova senha <span aria-hidden="true">*</span>
                          </Form.Label>
                          <Button
                            type="button"
                            variant="link"
                            className="forgot-link"
                            aria-pressed={showPassword}
                            onClick={() =>
                              setShowPassword((visible) => !visible)
                            }
                          >
                            {showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                          </Button>
                        </div>
                        <Form.Control
                          type={showPassword ? 'text' : 'password'}
                          name="new-password"
                          autoComplete="new-password"
                          minLength={8}
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          required
                        />
                        <Form.Text>Use pelo menos 8 caracteres.</Form.Text>
                      </Form.Group>

                      <Form.Group className="mb-4" controlId="confirmPassword">
                        <div className="password-label-row">
                          <Form.Label>
                            Confirmar nova senha{' '}
                            <span aria-hidden="true">*</span>
                          </Form.Label>
                          <Button
                            type="button"
                            variant="link"
                            className="forgot-link"
                            aria-pressed={showConfirmation}
                            onClick={() =>
                              setShowConfirmation((visible) => !visible)
                            }
                          >
                            {showConfirmation
                              ? 'Ocultar senha'
                              : 'Mostrar senha'}
                          </Button>
                        </div>
                        <Form.Control
                          type={showConfirmation ? 'text' : 'password'}
                          name="confirm-password"
                          autoComplete="new-password"
                          minLength={8}
                          value={confirmation}
                          onChange={(event) =>
                            setConfirmation(event.target.value)
                          }
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
                        {isSubmitting ? 'Salvando...' : 'Salvar nova senha'}
                      </Button>
                    </Form>
                  </>
                )}
              </>
            ) : (
              <>
                <p className="login-intro recovery-intro">
                  Para criar uma nova senha, abra o link enviado para o e-mail
                  cadastrado.
                </p>
                <Alert
                  variant="warning"
                  className="recovery-notice"
                  role="alert"
                >
                  O link de recuperação não foi encontrado nesta página.
                  Solicite um novo link para continuar.
                </Alert>
                <Link
                  className="btn btn-primary btn-lg w-100 recovery-action"
                  to="/recuperar-senha"
                >
                  Solicitar novo link
                </Link>
              </>
            )}
          </Card.Body>
        </Card>
        <Link className="back-link" to="/login">
          Voltar para o acesso
        </Link>
      </Container>
    </main>
  );
}

export default PasswordResetPage;
