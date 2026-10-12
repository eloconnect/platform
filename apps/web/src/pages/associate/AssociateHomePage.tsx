import { Alert, Badge, Button, Card, Col, Row } from 'react-bootstrap';
import { Link, useOutletContext } from 'react-router-dom';
import type { MemberOverview } from '../../lib/auth';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(
    new Date(`${value.slice(0, 10)}T12:00:00`),
  );
}

function AssociateHomePage() {
  const { overview } = useOutletContext<{ overview: MemberOverview }>();
  const nextBill = overview.openBills[0];
  const statusLabels: Record<string, string> = {
    ADIMPLENTE: 'Adimplente',
    INADIMPLENTE: 'Contribuição pendente',
    CANCELAMENTO_SOLICITADO: 'Cancelamento solicitado',
    CANCELADO: 'Associação desativada',
  };

  return (
    <div className="portal-page">
      <div className="portal-page-heading">
        <div>
          <p className="portal-kicker">ÁREA DO ASSOCIADO</p>
          <h1>Início</h1>
          <p>Acompanhe sua associação, contribuições e serviços sindicais.</p>
        </div>
        <Badge
          bg={
            overview.associate.status === 'ADIMPLENTE' ? 'success' : 'secondary'
          }
        >
          {statusLabels[overview.associate.status] ?? overview.associate.status}
        </Badge>
      </div>

      {overview.associate.status === 'CANCELADO' && (
        <Alert variant="warning">
          Sua associação está desativada. Você ainda pode acessar sua conta e
          consultar os boletos e pagamentos anteriores.
        </Alert>
      )}

      <Card className="portal-status-card">
        <Card.Body>
          <div>
            <p className="portal-kicker">CADASTRO DO ESTABELECIMENTO</p>
            <h2>
              {overview.associate.tradeName || overview.associate.legalName}
            </h2>
            <span>
              Situação:{' '}
              <strong>{statusLabels[overview.associate.status]}</strong>
            </span>
          </div>
          <span className="portal-status-dot" aria-hidden="true" />
        </Card.Body>
      </Card>

      <Row className="g-4 portal-overview-grid">
        <Col lg={7}>
          <Card className="portal-bill-card h-100">
            <Card.Body>
              <div className="portal-section-heading">
                <div>
                  <p className="portal-kicker">CONTRIBUIÇÃO SINDICAL</p>
                  <h2>Contribuições e boletos</h2>
                </div>
                <span aria-hidden="true" className="portal-icon">
                  ▣
                </span>
              </div>
              {nextBill ? (
                <>
                  <div className="portal-bill-highlight">
                    <Badge bg="light" text="primary">
                      {nextBill.identifier}
                    </Badge>
                    <p>
                      Valor <strong>{formatCurrency(nextBill.amount)}</strong>
                    </p>
                    <p>
                      Vencimento:{' '}
                      <strong>{formatDate(nextBill.dueDate)}</strong>
                    </p>
                  </div>
                  {nextBill.identifier.startsWith('DEMO-') && (
                    <Alert variant="info" className="mb-3">
                      Boleto demonstrativo. O pagamento ainda não está conectado
                      a um banco ou provedor.
                    </Alert>
                  )}
                  <div className="portal-button-row">
                    {nextBill.hasPix ? (
                      <Link className="btn btn-primary" to="/associado/boletos">
                        Pagar com PIX
                      </Link>
                    ) : (
                      <Button
                        disabled
                        title="Aguardando integração de pagamento"
                      >
                        PIX indisponível
                      </Button>
                    )}
                    <Link
                      className="btn btn-outline-primary"
                      to="/associado/boletos"
                    >
                      Ver boletos e histórico
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <p className="portal-empty-copy">
                    Não há boletos em aberto no momento.
                  </p>
                  <Link
                    className="btn btn-outline-primary"
                    to="/associado/boletos"
                  >
                    Consultar histórico de pagamentos
                  </Link>
                </>
              )}
            </Card.Body>
          </Card>
        </Col>
        <Col lg={5}>
          <Card className="portal-contribution-card h-100">
            <Card.Body>
              <span aria-hidden="true" className="portal-icon">
                ↻
              </span>
              <p className="portal-kicker">CONTRIBUIÇÃO VIGENTE</p>
              {overview.contribution ? (
                <>
                  <h2>
                    {formatCurrency(overview.contribution.monthlyAmount)}{' '}
                    <small>/ mês</small>
                  </h2>
                  <p>
                    Contribuição anual à vista:{' '}
                    <strong>
                      {formatCurrency(overview.contribution.annualAmount)}
                    </strong>
                    {overview.contribution.monthlyAmount > 0 &&
                      overview.contribution.annualAmount <
                        overview.contribution.monthlyAmount * 12 && (
                        <>
                          {' '}
                          (economia de{' '}
                          {Math.round(
                            (1 -
                              overview.contribution.annualAmount /
                                (overview.contribution.monthlyAmount * 12)) *
                              100,
                          )}
                          %)
                        </>
                      )}
                  </p>
                  <p>
                    Valores da contribuição definidos pelo sindicato. O
                    pagamento anual ainda não está habilitado.
                  </p>
                  <Button disabled title="Aguardando integração de pagamento">
                    Pagar contribuição anual
                  </Button>
                </>
              ) : (
                <p>Os valores de contribuição ainda não foram cadastrados.</p>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <section
        className="portal-shortcuts"
        aria-labelledby="portal-services-title"
      >
        <div className="portal-section-heading">
          <div>
            <p className="portal-kicker">SERVIÇOS</p>
            <h2 id="portal-services-title">O que você precisa hoje?</h2>
          </div>
        </div>
        <Row className="g-3">
          <Col sm={6} lg={3}>
            <Link className="portal-shortcut" to="/associado/boletos">
              <span>▣</span>
              <strong>Contribuições e boletos</strong>
              <small>Consulte valores e histórico</small>
            </Link>
          </Col>
          {overview.access.benefits && (
            <Col sm={6} lg={3}>
              <Link className="portal-shortcut" to="/associado/beneficios">
                <span>✦</span>
                <strong>Benefícios</strong>
                <small>Serviços para associados</small>
              </Link>
            </Col>
          )}
          {overview.access.conventions && (
            <Col sm={6} lg={3}>
              <Link className="portal-shortcut" to="/associado/convencoes">
                <span>▤</span>
                <strong>Convenções coletivas</strong>
                <small>Documentos e acordos publicados</small>
              </Link>
            </Col>
          )}
          <Col sm={6} lg={3}>
            <Link className="portal-shortcut" to="/associado/noticias">
              <span>◷</span>
              <strong>Notícias</strong>
              <small>Informações da categoria</small>
            </Link>
          </Col>
          {overview.access.support && (
            <Col sm={6} lg={3}>
              <Link className="portal-shortcut" to="/associado/suporte">
                <span>☎</span>
                <strong>Suporte</strong>
                <small>Fale com a equipe</small>
              </Link>
            </Col>
          )}
        </Row>
      </section>

      <section
        className="portal-news-preview"
        aria-labelledby="portal-news-title"
      >
        <div className="portal-section-heading">
          <div>
            <p className="portal-kicker">INFORMAÇÃO</p>
            <h2 id="portal-news-title">Últimas notícias</h2>
          </div>
          <Link to="/associado/noticias">Ver todas</Link>
        </div>
        {overview.news.length ? (
          <Row className="g-3">
            {overview.news.slice(0, 3).map((news) => (
              <Col md={4} key={news.id}>
                <Card className="portal-news-card h-100">
                  <Card.Body>
                    <h3>{news.title}</h3>
                    <p>{news.content}</p>
                    {news.publishedAt && (
                      <small>{formatDate(news.publishedAt)}</small>
                    )}
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
        ) : (
          <p className="portal-empty-copy">
            Nenhuma notícia foi publicada ainda.
          </p>
        )}
      </section>

      {overview.associate.status !== 'CANCELADO' && (
        <div className="portal-cancel-link">
          <Link to="/associado/cancelamento">
            Solicitar desativação da associação
          </Link>
        </div>
      )}
    </div>
  );
}

export default AssociateHomePage;
