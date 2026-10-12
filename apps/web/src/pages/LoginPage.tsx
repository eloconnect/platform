import { useState, type FormEvent } from "react";
import { Alert, Button, Card, Container, Form } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import Brand from "../components/Brand";
import {
  AuthApiError,
  login,
  resendEmailCode,
  verifyEmailCode,
} from "../lib/auth";

function LoginPage() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [challengeToken, setChallengeToken] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setIsSubmitting(true);
    try {
      const result = await login(email, password, rememberMe);
      if (!result) {
        throw new Error("A API não iniciou a verificação por e-mail.");
      }
      if (!("requiresTwoFactor" in result)) {
        navigate(result.user.role === "ADMIN" ? "/admin" : "/associado");
        return;
      }
      setChallengeToken(result.challengeToken);
      setMaskedEmail(result.maskedEmail);
      setPassword("");
      setNotice(
        result.emailSent
          ? `Enviamos um código de acesso para ${result.maskedEmail}.`
          : "Não foi possível enviar o código. Use a opção de reenvio para tentar novamente.",
      );
    } catch (submissionError) {
      setError(
        submissionError instanceof AuthApiError
          ? submissionError.message
          : "Não foi possível acessar sua conta. Tente novamente.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerifySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setIsSubmitting(true);
    try {
      const result = await verifyEmailCode(
        challengeToken,
        verificationCode,
        rememberMe,
      );
      if (!result || result.purpose !== "LOGIN") {
        throw new Error("A API não confirmou a autenticação.");
      }
      navigate(result.user.role === "ADMIN" ? "/admin" : "/associado");
    } catch (submissionError) {
      setError(
        submissionError instanceof AuthApiError
          ? submissionError.message
          : "Não foi possível confirmar o código. Confira e tente novamente.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResendCode() {
    if (!challengeToken) return;
    setError("");
    setNotice("");
    setIsSubmitting(true);
    try {
      const result = await resendEmailCode(challengeToken);
      setNotice(result?.message ?? "Não foi possível reenviar o código.");
    } catch (resendError) {
      setError(
        resendError instanceof AuthApiError
          ? resendError.message
          : "Não foi possível reenviar o código.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function restartLogin() {
    setChallengeToken("");
    setVerificationCode("");
    setNotice("");
    setError("");
  }

  return (
    <main className="login-page">
      <a className="skip-link" href="#login-form">
        Ir para o formulário de acesso
      </a>
      <Container className="login-container">
        <Card className="login-card">
          <Card.Body>
            <div className="login-brand">
              <Brand />
            </div>
            <h1 className="login-intro login-title">
              {challengeToken ? "Confirme seu e-mail" : "Acesse sua área"}
            </h1>

            {error && (
              <Alert variant="danger" className="form-notice" role="alert">
                {error}
              </Alert>
            )}
            {notice && (
              <Alert
                variant="info"
                className="form-notice"
                role="status"
                aria-live="polite"
              >
                {notice}
              </Alert>
            )}

            {challengeToken && (
              <p>
                Informe o código de seis dígitos enviado para{" "}
                <strong>{maskedEmail}</strong>.
              </p>
            )}
            <Form
              id="login-form"
              tabIndex={-1}
              onSubmit={challengeToken ? handleVerifySubmit : handleSubmit}
            >
              {challengeToken ? (
                <Form.Group className="mb-3" controlId="loginVerificationCode">
                  <Form.Label>Código de verificação</Form.Label>
                  <Form.Control
                    required
                    autoFocus
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    minLength={6}
                    maxLength={6}
                    value={verificationCode}
                    onChange={(event) =>
                      setVerificationCode(event.target.value.replace(/\D/g, ""))
                    }
                  />
                  <Form.Text>O código expira em 10 minutos.</Form.Text>
                </Form.Group>
              ) : (
                <>
                  <Form.Group className="mb-3" controlId="loginEmail">
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

                  <Form.Group className="mb-3" controlId="loginPassword">
                    <div className="password-label-row">
                      <Form.Label>
                        Senha de acesso <span aria-hidden="true">*</span>
                      </Form.Label>
                      <Link className="forgot-link" to="/recuperar-senha">
                        Esqueci minha senha
                      </Link>
                    </div>
                    <div className="password-control">
                      <Form.Control
                        type={showPassword ? "text" : "password"}
                        name="password"
                        autoComplete="current-password"
                        placeholder="Digite sua senha"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        required
                      />
                      <Button
                        type="button"
                        variant="light"
                        className="password-toggle"
                        aria-label={
                          showPassword ? "Ocultar senha" : "Mostrar senha"
                        }
                        aria-pressed={showPassword}
                        onClick={() => setShowPassword((visible) => !visible)}
                      >
                        {showPassword ? "Ocultar" : "Mostrar"}
                      </Button>
                    </div>
                  </Form.Group>

                  <Form.Check
                    className="remember-check"
                    type="checkbox"
                    id="remember-device"
                    label="Lembrar neste dispositivo"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                  />
                </>
              )}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-100 login-submit"
                disabled={isSubmitting}
              >
                <span aria-hidden="true">↪</span>{" "}
                {isSubmitting
                  ? "Aguarde..."
                  : challengeToken
                    ? "Confirmar código"
                    : "Continuar"}
              </Button>
            </Form>
            {challengeToken ? (
              <div className="registration-copy">
                <Button
                  type="button"
                  variant="link"
                  disabled={isSubmitting}
                  onClick={handleResendCode}
                >
                  Reenviar código
                </Button>
                <Button
                  type="button"
                  variant="link"
                  disabled={isSubmitting}
                  onClick={restartLogin}
                >
                  Voltar ao login
                </Button>
              </div>
            ) : (
              <p className="registration-copy">
                Ainda não tem acesso?{" "}
                <Link to="/cadastro">Solicite uma conta para sua farmácia</Link>
                . O administrador precisa aprovar o cadastro.
              </p>
            )}
          </Card.Body>
        </Card>
        <Link className="back-link" to="/">
          Voltar para a página inicial
        </Link>
      </Container>
    </main>
  );
}

export default LoginPage;
