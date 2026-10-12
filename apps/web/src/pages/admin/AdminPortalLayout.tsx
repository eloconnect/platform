import { useEffect, useState } from "react";
import { Alert, Button, Container, Nav, Spinner } from "react-bootstrap";
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import Brand from "../../components/Brand";
import { AuthApiError, getCurrentUser, logout } from "../../lib/auth";

function AdminPortalLayout() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let mounted = true;
    getCurrentUser()
      .then((session) => {
        if (!mounted) return;
        if (session?.user.role === "ADMIN") {
          setAuthorized(true);
        } else {
          setError(
            session ? "Esta área é exclusiva para contas administrativas." : "",
          );
        }
      })
      .catch((requestError: unknown) => {
        if (!mounted) return;
        if (
          !(requestError instanceof AuthApiError) ||
          requestError.status !== 401
        ) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Não foi possível validar seu acesso.",
          );
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  async function handleLogout() {
    try {
      await logout();
      navigate("/login", { replace: true });
    } catch (logoutError) {
      setError(
        logoutError instanceof Error
          ? logoutError.message
          : "Não foi possível encerrar a sessão.",
      );
    }
  }

  if (loading) {
    return (
      <main className="admin-loading" aria-live="polite">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Validando acesso...</span>
        </Spinner>
        <p>Validando acesso administrativo...</p>
      </main>
    );
  }
  if (!authorized) {
    return error ? (
      <main className="admin-loading">
        <Container className="admin-auth-error">
          <Alert variant="warning" role="alert">
            {error}
          </Alert>
          <Link className="btn btn-primary" to="/login">
            Ir para o acesso
          </Link>
        </Container>
      </main>
    ) : (
      <Navigate to="/login" replace state={{ from: location.pathname }} />
    );
  }

  return (
    <div className="admin-portal">
      <a className="skip-link" href="#admin-content">
        Ir para o conteúdo
      </a>
      <header className="admin-topbar">
        <Brand />
        <div className="admin-topbar-meta">
          <span className="admin-connection-status">Gestão da sede</span>
          <Button variant="link" onClick={handleLogout}>
            Sair
          </Button>
        </div>
      </header>
      <div className="admin-shell">
        <aside className="admin-sidebar" aria-label="Navegação administrativa">
          <p className="admin-sidebar-label">ADMINISTRAÇÃO SINDICAL</p>
          <Nav className="admin-sidebar-nav">
            <Nav.Link as={NavLink} to="/admin" end>
              <span aria-hidden="true">▦</span> Painel executivo
            </Nav.Link>
            <Nav.Link as={NavLink} to="/admin/valores">
              <span aria-hidden="true">R$</span> Valores e reajustes
            </Nav.Link>
            <Nav.Link as={NavLink} to="/admin/convencoes">
              <span aria-hidden="true">▤</span> Convenções e benefícios
            </Nav.Link>
            <Nav.Link as={NavLink} to="/admin/cadastros">
              <span aria-hidden="true">✓</span> Aprovar cadastros
            </Nav.Link>
          </Nav>
          <div className="admin-sidebar-note">
            <strong>Elo Connect</strong>
            <span>Ferramenta administrativa do sindicato patronal.</span>
          </div>
        </aside>
        <main className="admin-content" id="admin-content">
          <Container fluid>
            {error && (
              <Alert variant="danger" role="alert">
                {error}
              </Alert>
            )}
            <Outlet />
          </Container>
        </main>
      </div>
    </div>
  );
}

export default AdminPortalLayout;
