import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { Alert, Button, Card, Form } from 'react-bootstrap';
import { useTituloPagina } from '../../componentes';

/**
 * Tela de Login (US03 / Issue #17)
 * Integrada ao React Bootstrap e ao tema.scss do Elo Connect.
 */
export function PaginaEntrar() {
  useTituloPagina('Entrar');
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [lembrar, setLembrar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setErro(null);

    if (!email || !senha) {
      setErro('Por favor, preencha o e-mail e a senha.');
      return;
    }

    try {
      setCarregando(true);
      const resposta = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha }),
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        throw new Error(dados.message || 'E-mail ou senha incorretos.');
      }

      if (lembrar) {
        localStorage.setItem('accessToken', dados.accessToken);
      } else {
        sessionStorage.setItem('accessToken', dados.accessToken);
      }

      if (dados.usuario?.perfil === 'ADMIN') {
        void navigate('/admin');
      } else {
        void navigate('/associado');
      }
    } catch (err) {
      setErro(
        err instanceof Error
          ? err.message
          : 'Não foi possível entrar. Verifique seus dados e tente novamente.',
      );
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="d-flex align-items-center justify-content-center min-vh-100 bg-light py-4 px-3">
      <Card
        style={{ maxWidth: '440px' }}
        className="w-100 border-0 shadow-sm rounded-4 p-3 p-md-4"
      >
        <Card.Body>
          {/* Cabeçalho do Card */}
          <div className="text-center mb-4">
            <div className="logo-elo-connect mx-auto" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="#ffffff"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            </div>
            <h2 className="h5 fw-bold mb-0">Elo Connect</h2>
            <p className="text-muted small mb-0">Gestão sindical</p>
            <h1 className="h3 fw-bold mt-4 mb-0">Entrar</h1>
          </div>

          {/* Abas de Navegação */}
          <div className="d-flex bg-light p-1 rounded-3 mb-4 text-center">
            <Button
              variant="white"
              className="flex-fill fw-bold text-primary shadow-sm rounded-2 py-2"
              disabled
            >
              Já sou associado
            </Button>
            <Link
              to="/cadastrar-farmacia"
              className="flex-fill py-2 text-decoration-none text-secondary font-weight-medium"
            >
              Cadastrar farmácia
            </Link>
          </div>

          {/* Quadro Informativo */}
          <div className="bg-light border rounded-3 p-3 mb-4">
            <strong className="d-block fw-bold text-dark mb-1">
              Ambiente seguro e exclusivo
            </strong>
            <small className="text-secondary d-block">
              Acesso restrito a proprietários, sócios-administradores e
              farmacêuticos titulares credenciados.
            </small>
          </div>

          {/* Alerta de Erro */}
          {erro && (
            <Alert variant="danger" className="mb-4">
              {erro}
            </Alert>
          )}

          {/* Formulário */}
          <Form onSubmit={handleLogin}>
            {/* E-mail */}
            <Form.Group className="mb-3" controlId="email">
              <Form.Label className="fw-bold">
                E-mail cadastrado <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                type="email"
                name="email"
                autoComplete="username"
                required
                placeholder="voce@farmacia.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Form.Group>

            {/* Senha */}
            <Form.Group className="mb-3" controlId="senha">
              <div className="d-flex justify-content-between align-items-center mb-1">
                <Form.Label className="fw-bold mb-0">
                  Senha de acesso <span className="text-danger">*</span>
                </Form.Label>
                <Link
                  to="/esqueci-senha"
                  className="small text-primary fw-semibold"
                >
                  Esqueci minha senha
                </Link>
              </div>
              <div className="d-flex gap-2">
                <Form.Control
                  type={mostrarSenha ? 'text' : 'password'}
                  name="password"
                  autoComplete="current-password"
                  required
                  placeholder="Digite sua senha"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                />
                <Button
                  variant="outline-secondary"
                  onClick={() => setMostrarSenha(!mostrarSenha)}
                  aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {mostrarSenha ? 'Ocultar' : 'Mostrar'}
                </Button>
              </div>
            </Form.Group>

            {/* Lembrar neste dispositivo */}
            <Form.Group className="mb-4" controlId="lembrar">
              <Form.Check
                type="checkbox"
                label="Lembrar neste dispositivo"
                checked={lembrar}
                onChange={(e) => setLembrar(e.target.checked)}
              />
            </Form.Group>

            {/* Botão de Envio */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-100 fw-bold py-3"
              disabled={carregando}
            >
              {carregando ? 'Entrando...' : 'Continuar'}
            </Button>
          </Form>
        </Card.Body>
      </Card>
    </div>
  );
}
