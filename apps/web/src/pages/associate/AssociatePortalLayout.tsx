import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Container,
  Nav,
  Navbar,
  Spinner,
} from 'react-bootstrap';
import {
  Link,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
  useOutletContext,
} from 'react-router-dom';
import Brand from '../../components/Brand';
import {
  AuthApiError,
  getCurrentUser,
  getMemberOverview,
  logout,
  type MemberOverview,
} from '../../lib/auth';

interface PortalContext {
  overview: MemberOverview;
  refreshOverview: () => Promise<void>;
}

function AssociatePortalLayout() {
  const [overview, setOverview] = useState<MemberOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  const refreshOverview = useCallback(async () => {
    const result = await getMemberOverview();
    if (!result) {
      throw new Error('A API não retornou os dados da área do associado.');
    }
    setOverview(result);
  }, []);

  useEffect(() => {
    let mounted = true;
    async function loadPortal() {
      setIsLoading(true);
      setError('');
      try {
        const session = await getCurrentUser();
        if (!mounted) return;
        if (!session) {
          setIsAuthenticated(false);
          return;
        }
        if (session.user.role !== 'ASSOCIATE') {
          setIsAuthenticated(false);
          setError('Esta área é exclusiva para contas de associado.');
          return;
        }
        setIsAuthenticated(true);
        const data = await getMemberOverview();
        if (mounted) setOverview(data);
      } catch (loadError) {
        if (!mounted) return;
        if (loadError instanceof AuthApiError && loadError.status === 401) {
          setIsAuthenticated(false);
        } else {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Não foi possível carregar sua área do associado.',
          );
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    void loadPortal();
    return () => {
      mounted = false;
    };
  }, []);

  async function handleLogout() {
    setError('');
    try {
      await logout();
      setIsAuthenticated(false);
      navigate('/login', { replace: true });
    } catch (logoutError) {
      setError(
        logoutError instanceof Error
          ? logoutError.message
          : 'Não foi possível encerrar a sessão.',
      );
    }
  }

  if (isLoading) {
    return (
      <main className="portal-loading" aria-live="polite">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Carregando sua área...</span>
        </Spinner>
        <p>Carregando sua área do associado...</p>
      </main>
    );
  }

  if (isAuthenticated === false) {
    return error ? (
      <main className="portal-loading">
        <Container className="portal-auth-error">
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

  if (!overview) {
    return (
      <main className="portal-loading">
        <Container className="portal-auth-error">
          <Alert variant="danger" role="alert">
            {error || 'Não foi possível carregar os dados da sua associação.'}
          </Alert>
          <Button variant="primary" onClick={() => window.location.reload()}>
            Tentar novamente
          </Button>
        </Container>
      </main>
    );
  }

  const isRestrictedPath =
    (location.pathname.endsWith('/beneficios') &&
      !overview.access.benefits) ||
    (location.pathname.endsWith('/suporte') && !overview.access.support) ||
    (location.pathname.endsWith('/convencoes') &&
      !overview.access.conventions) ||
    (location.pathname.endsWith('/cancelamento') &&
      overview.associate.status === 'CANCELADO');
  if (isRestrictedPath) {
    return <Navigate to="/associado" replace />;
  }

  const portalContext: PortalContext = { overview, refreshOverview };

  return (
    <div className="associate-portal">
      <a className="skip-link" href="#portal-content">
        Ir para o conteúdo
      </a>
      <header className="portal-header">
        <Navbar expand="lg" className="portal-navbar">
          <Container fluid="xl">
            <Brand />
            <Navbar.Toggle
              aria-label="Abrir ou fechar menu"
              aria-controls="associate-navigation"
            />
            <Navbar.Collapse id="associate-navigation">
              <Nav className="portal-nav me-auto">
                <Nav.Link as={Link} to="/associado">
                  Início
                </Nav.Link>
                <Nav.Link as={Link} to="/associado/boletos">
                  Boletos
                </Nav.Link>
                {overview.access.benefits && (
                  <Nav.Link as={Link} to="/associado/beneficios">
                    Benefícios &amp; suporte
                  </Nav.Link>
                )}
                {overview.access.conventions && (
                  <Nav.Link as={Link} to="/associado/convencoes">
                    Convenções coletivas
                  </Nav.Link>
                )}
                <Nav.Link as={Link} to="/associado/noticias">
                  Notícias
                </Nav.Link>
              </Nav>
              <div className="portal-header-account">
                <span>
                  {overview.associate.tradeName || overview.associate.legalName}
                </span>
                <Button variant="link" onClick={handleLogout}>
                  Sair
                </Button>
              </div>
            </Navbar.Collapse>
          </Container>
        </Navbar>
      </header>
      <main className="portal-content" id="portal-content">
        <Container fluid="xl">
          {error && (
            <Alert variant="danger" role="alert">
              {error}
            </Alert>
          )}
          <Outlet context={portalContext} />
        </Container>
      </main>
      <footer className="portal-footer">
        <Container fluid="xl" className="portal-footer-content">
          <span>
            © Elo Connect · Sistema Integrado de Gestão e Relacionamento
            Sindical Farmacêutico
          </span>
          {overview.access.support ? (
            <>
              <span>
                Central Nacional: <a href="tel:08007243000">0800 724 3000</a>
              </span>
              <span>Atendimento: segunda a sexta, das 8h às 18h</span>
            </>
          ) : (
            <span>
              Atendimento exclusivo indisponível para o status atual da
              associação.
            </span>
          )}
        </Container>
      </footer>
    </div>
  );
}

export default AssociatePortalLayout;

export function useAssociatePortal(): PortalContext {
  return useOutletContext<PortalContext>();
}
