import { Badge, Card, Col, Container, Nav, Navbar, Row } from "react-bootstrap";
import { Link } from "react-router-dom";
import Brand from "../components/Brand";

const conventionResources = [
  {
    title: "Convenções coletivas de trabalho",
    description: "Acordos e informações da categoria.",
  },
  {
    title: "Pisos salariais e reajustes",
    description: "Orientações sobre regras e atualizações salariais.",
  },
  {
    title: "Direitos e deveres da categoria",
    description: "Conteúdos para apoiar a rotina da sua farmácia.",
  },
];

function LandingPage() {
  return (
    <div className="landing-page">
      <a className="skip-link" href="#conteudo">
        Ir para o conteúdo
      </a>

      <header className="site-header">
        <Navbar className="primary-nav" bg="white" expand="xl">
          <Container fluid="xl">
            <Brand />
            <Navbar.Toggle
              aria-label="Abrir ou fechar menu"
              aria-controls="primary-navigation"
            />
            <Navbar.Collapse id="primary-navigation">
              <Nav className="site-nav mx-auto">
                <Nav.Link href="#inicio">Painel</Nav.Link>
                <Nav.Link href="#convencoes">Convenções coletivas</Nav.Link>
                <Nav.Link href="#cadastro">Associados</Nav.Link>
                <Nav.Link href="#atuacao">Jurídico sindical</Nav.Link>
                <Nav.Link href="#contribuicoes">Contribuições</Nav.Link>
              </Nav>
              <div className="header-actions">
                <Link className="btn btn-outline-primary btn-lg" to="/login">
                  Entrar
                </Link>
                <Link className="btn btn-primary btn-lg" to="/cadastro">
                  Criar conta
                </Link>
              </div>
            </Navbar.Collapse>
          </Container>
        </Navbar>
      </header>

      <main id="conteudo">
        <section
          className="hero-section"
          id="inicio"
          aria-labelledby="hero-title"
        >
          <Container fluid="xl">
            <Row className="align-items-center g-4 g-xl-5">
              <Col lg={7}>
                <div>
                  <Badge bg="light" text="primary" className="section-badge">
                    Representação sindical forte e próxima
                  </Badge>
                  <h1 id="hero-title">
                    A força que impulsiona e protege o{" "}
                    <span className="hero-emphasis">setor farmacêutico.</span>
                  </h1>
                  <p className="hero-copy">
                    Segurança jurídica trabalhista, negociações coletivas e
                    orientação para farmácias e drogarias crescerem com
                    estabilidade e informação.
                  </p>
                  <div className="hero-actions">
                    <Link className="btn btn-primary btn-lg" to="/login">
                      Entrar
                    </Link>
                    <Link
                      className="btn btn-outline-primary btn-lg"
                      to="/cadastro"
                    >
                      Criar conta
                    </Link>
                  </div>
                </div>

                <Row className="metrics-row g-3">
                  <Col xs={12} sm={4}>
                    <Card className="metric-card h-100">
                      <Card.Body>
                        <strong>~2.000</strong>
                        <span>farmácias no setor em Mato Grosso</span>
                      </Card.Body>
                    </Card>
                  </Col>
                  <Col xs={12} sm={4}>
                    <Card className="metric-card h-100">
                      <Card.Body>
                        <strong>~150</strong>
                        <span>associados com contribuição mensal</span>
                      </Card.Body>
                    </Card>
                  </Col>
                  <Col xs={12} sm={4}>
                    <Card className="metric-card h-100">
                      <Card.Body>
                        <strong>Dia 10</strong>
                        <span>vencimento mensal da contribuição</span>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>
              </Col>

              <Col lg={5}>
                <div className="pharmacy-visual">
                  <img
                    src="/images/farmacia-equipe.png"
                    alt="Equipe de profissionais em atendimento em uma farmácia."
                    width="360"
                    height="270"
                  />
                </div>
                <div className="hero-update">
                  <span className="update-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" focusable="false">
                      <path
                        d="M12 3v18m0-18 7 7m-7-7L5 10M5 14h14v6H5z"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                      />
                    </svg>
                  </span>
                  <span>
                    <strong>Convenções coletivas</strong>
                    <span>
                      Acompanhe as orientações publicadas para o setor.
                    </span>
                  </span>
                  <a href="#convencoes" aria-label="Ver convenções coletivas">
                    <span aria-hidden="true">→</span>
                  </a>
                </div>
              </Col>
            </Row>
          </Container>
        </section>

        <section
          className="benefits-section page-section"
          id="atuacao"
          aria-labelledby="benefits-title"
        >
          <Container fluid="xl">
            <div className="benefits-intro">
              <Badge bg="light" text="primary" className="section-badge">
                Conteúdo provisório — benefícios a definir (P06)
              </Badge>
              <h2 className="section-title" id="benefits-title">
                Como o sindicato pode apoiar sua farmácia
              </h2>
              <p className="section-copy">
                A lista oficial de benefícios ainda depende de definição com o
                cliente. Os exemplos abaixo são provisórios e não confirmam
                disponibilidade.
              </p>
            </div>

            <Row className="benefits-grid g-3 g-xl-4">
              <Col md={6}>
                <Card className="benefit-card h-100">
                  <Card.Body>
                    <span className="benefit-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" focusable="false">
                        <path
                          d="M12 3 5 6v5c0 4.5 2.9 8.3 7 10 4.1-1.7 7-5.5 7-10V6l-7-3Zm-3 9 2 2 4-4"
                          fill="none"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="1.8"
                        />
                      </svg>
                    </span>
                    <h3>Suporte e orientação jurídica</h3>
                    <p>
                      Orientação e defesa jurídica sindical em temas
                      trabalhistas, conforme as regras de atendimento.
                    </p>
                    <a href="#cadastro">Saiba mais sobre a filiação</a>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={6}>
                <Card className="benefit-card h-100">
                  <Card.Body>
                    <span className="benefit-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" focusable="false">
                        <path
                          d="M8 8h-2a4 4 0 0 0 0 8h2m8-8h2a4 4 0 0 1 0 8h-2m-8-4h8m-5-9v2m2 14v2"
                          fill="none"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="1.8"
                        />
                      </svg>
                    </span>
                    <h3>Negociação coletiva e representação</h3>
                    <p>
                      Acompanhe as convenções coletivas e as atualizações que
                      impactam a categoria.
                    </p>
                    <a href="#convencoes">Consultar convenções coletivas</a>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={6}>
                <Card className="benefit-card h-100">
                  <Card.Body>
                    <span className="benefit-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" focusable="false">
                        <path
                          d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21V5.5Zm0 0V21m4-13h8m-8 4h6"
                          fill="none"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="1.8"
                        />
                      </svg>
                    </span>
                    <h3>Informação para a gestão da farmácia</h3>
                    <p>
                      Encontre orientações sindicais e informações importantes
                      da categoria em um só lugar.
                    </p>
                    <a href="#convencoes">Ver informações da categoria</a>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={6}>
                <Card className="benefit-card h-100">
                  <Card.Body>
                    <span className="benefit-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" focusable="false">
                        <path
                          d="M4 7h16v13H4zM8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m-12 5h16m-10 0v2h4v-2"
                          fill="none"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="1.8"
                        />
                      </svg>
                    </span>
                    <h3>Apoio em temas trabalhistas</h3>
                    <p>
                      Consulte conteúdos e orientações sindicais sobre direitos,
                      deveres e relações de trabalho.
                    </p>
                    <a href="#cadastro">Conheça o Elo Connect</a>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          </Container>
        </section>

        <section
          className="conventions-section page-section"
          id="convencoes"
          aria-labelledby="conventions-title"
        >
          <Container fluid="xl">
            <Card className="conventions-card border-0">
              <Card.Body>
                <Row className="align-items-center g-4">
                  <Col lg={5}>
                    <Badge bg="light" text="primary" className="section-badge">
                      Documentação oficial
                    </Badge>
                    <h2 className="section-title" id="conventions-title">
                      Convenções coletivas e pisos salariais
                    </h2>
                    <p className="section-copy">
                      Acompanhe os resumos das convenções coletivas e as
                      orientações preparadas pelo sindicato para apoiar a rotina
                      da sua farmácia.
                    </p>
                    <ul className="topic-list">
                      <li>
                        <strong>Informação salarial</strong>
                        <span>
                          Orientações sobre pisos e atualizações da categoria.
                        </span>
                      </li>
                      <li>
                        <strong>Regras da categoria</strong>
                        <span>
                          Consulte informações gerais sobre convenções
                          coletivas.
                        </span>
                      </li>
                      <li>
                        <strong>Conteúdo organizado</strong>
                        <span>
                          Acesse as publicações disponíveis para sua conta.
                        </span>
                      </li>
                    </ul>
                  </Col>
                  <Col lg={7}>
                    <div className="agreement-panel">
                      <div className="agreement-heading">
                        <span>Documento</span>
                        <span>Acesso</span>
                        <span>Ação</span>
                      </div>
                      {conventionResources.map((resource) => (
                        <div className="agreement-row" key={resource.title}>
                          <span className="document-icon" aria-hidden="true">
                            PDF
                          </span>
                          <div className="agreement-description">
                            <strong>{resource.title}</strong>
                            <span>{resource.description}</span>
                          </div>
                          <span className="agreement-period">
                            Área do associado
                          </span>
                          <Link
                            to="/login"
                            className="btn btn-primary agreement-button"
                          >
                            Entrar
                          </Link>
                        </div>
                      ))}
                    </div>
                    <p className="access-note">
                      Entre com sua conta para acessar os conteúdos da área do
                      associado.
                    </p>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          </Container>
        </section>

        <section className="join-section page-section" id="cadastro">
          <Container fluid="xl">
            <Row className="align-items-center g-4">
              <Col lg={6}>
                <Badge bg="light" text="primary" className="section-badge">
                  Para farmácias e drogarias
                </Badge>
                <h2 className="section-title" id="join-title">
                  Fortaleça o seu negócio. Seja parte do sindicato que luta pela
                  sua farmácia.
                </h2>
                <p className="section-copy">
                  Conte com informação e orientação sindical para apoiar o seu
                  estabelecimento, conhecer as convenções coletivas e acompanhar
                  as mudanças do setor.
                </p>
                <ul className="join-list">
                  <li>
                    <strong>Orientação sindical próxima</strong>
                    <span>
                      Informações para apoiar a rotina da sua farmácia.
                    </span>
                  </li>
                  <li>
                    <strong>Convenções coletivas em um só lugar</strong>
                    <span>
                      Consulte orientações e informações da categoria.
                    </span>
                  </li>
                  <li>
                    <strong>Atualizações do setor</strong>
                    <span>
                      Acompanhe os conteúdos institucionais publicados.
                    </span>
                  </li>
                </ul>
              </Col>
              <Col lg={6}>
                <Card className="request-card registration-card">
                  <Card.Body>
                    <div className="request-card-heading">
                      <div>
                        <span className="request-kicker">
                          Acesso à plataforma
                        </span>
                        <h3 id="contribuicoes">Criar conta</h3>
                      </div>
                      <Badge bg="primary">Com aprovação</Badge>
                    </div>
                    <p className="registration-copy">
                      Solicite o acesso com os dados da farmácia. A conta será
                      liberada após a aprovação do administrador, com
                      confirmação enviada ao seu e-mail.
                    </p>
                    <Link
                      className="btn btn-outline-primary btn-lg registration-link"
                      to="/cadastro"
                    >
                      Solicitar acesso
                    </Link>
                    <p className="registration-note">
                      Se já recebeu acesso, entre com seu e-mail e senha.
                    </p>
                    <Link
                      className="btn btn-primary btn-lg registration-link"
                      to="/login"
                    >
                      Entrar
                    </Link>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          </Container>
        </section>
      </main>

      <footer className="site-footer" id="contato">
        <div className="site-footer-main">
          <Container fluid="xl">
            <Row className="footer-columns g-4">
              <Col sm={6} lg={3}>
                <Brand />
                <p className="footer-description">
                  Entidade sindical patronal dedicada à representação e
                  orientação de farmácias e drogarias.
                </p>
                <div className="state-tags" aria-label="Atuação em Mato Grosso">
                  <span>MT</span>
                </div>
              </Col>
              <Col sm={6} lg={3}>
                <h2 className="footer-heading">Central de atendimento</h2>
                <p>
                  Acesse sua área para acompanhar os serviços e informações do
                  sindicato.
                </p>
                <Link className="footer-text-link" to="/login">
                  Acessar minha área
                </Link>
                <Link className="footer-text-link" to="/recuperar-senha">
                  Recuperar acesso
                </Link>
              </Col>
              <Col sm={6} lg={3}>
                <h2 className="footer-heading">Sede administrativa</h2>
                <p>
                  Representação sindical patronal de farmácias e drogarias de
                  Mato Grosso.
                </p>
                <a className="footer-text-link" href="#atuacao">
                  Conheça nossa atuação
                </a>
              </Col>
              <Col sm={6} lg={3}>
                <h2 className="footer-heading">Comunicados e convenções</h2>
                <p>
                  Consulte informações e orientações coletivas publicadas para a
                  categoria.
                </p>
                <a className="footer-alert-link" href="#convencoes">
                  <span aria-hidden="true">♧</span>
                  Ver convenções coletivas
                </a>
              </Col>
            </Row>
          </Container>
        </div>
        <div className="footer-bottom">
          <Container fluid="xl" className="footer-bottom-content">
            <div className="footer-legal-brand">
              <strong>Elo Connect</strong>
              <span>
                Plataforma institucional do sindicato patronal de farmácias e
                drogarias.
              </span>
            </div>
            <Nav aria-label="Links institucionais">
              <Nav.Link href="#convencoes">Normas coletivas</Nav.Link>
              <Nav.Link href="#atuacao">Orientação sindical</Nav.Link>
              <Nav.Link href="#contato">Atendimento</Nav.Link>
            </Nav>
            <small>
              © {new Date().getFullYear()} Elo Connect. Todos os direitos
              reservados.
            </small>
          </Container>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
