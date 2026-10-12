import { useEffect, useState } from 'react';
import { Alert, Card, Col, Row, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import {
  AuthApiError,
  getMemberBenefits,
  type MemberBenefit,
} from '../../lib/auth';

function AssociateBenefitsPage() {
  const [benefits, setBenefits] = useState<MemberBenefit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    getMemberBenefits()
      .then((result) => {
        if (mounted) setBenefits(result);
      })
      .catch((requestError: unknown) => {
        if (!mounted) return;
        setError(
          requestError instanceof AuthApiError
            ? requestError.message
            : 'Não foi possível carregar os benefícios.',
        );
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="portal-page">
      <div className="portal-membership-banner">
        <span aria-hidden="true" className="portal-icon">
          ✦
        </span>
        <div>
          <p className="portal-kicker">SITUAÇÃO CADASTRAL</p>
          <strong>Sua farmácia tem acesso aos serviços de associado.</strong>
        </div>
      </div>
      <div className="portal-page-heading">
        <div>
          <h1>Benefícios exclusivos do associado</h1>
          <p>
            Consulte os serviços e benefícios disponíveis para sua farmácia.
          </p>
        </div>
      </div>
      {error && (
        <Alert variant="danger" role="alert">
          {error}
        </Alert>
      )}
      {loading ? (
        <div className="portal-inline-loading">
          <Spinner animation="border" />
          Carregando benefícios...
        </div>
      ) : benefits.length ? (
        <Row className="g-4">
          {benefits.map((benefit, index) => (
            <Col md={6} key={benefit.id}>
              <Card className="portal-benefit-card h-100">
                <Card.Body>
                  <span aria-hidden="true" className="portal-icon">
                    {['⚖', '✦', '▣'][index % 3]}
                  </span>
                  <div>
                    <p className="portal-kicker">BENEFÍCIO DO ASSOCIADO</p>
                    <h2>{benefit.title}</h2>
                    <p>{benefit.description}</p>
                    <Link
                      className="btn btn-outline-primary"
                      to="/associado/suporte"
                    >
                      Consultar disponibilidade
                    </Link>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      ) : (
        <Card className="portal-empty-card">
          <Card.Body>
            <h2>Nenhum benefício publicado</h2>
            <p>
              Os benefícios aparecerão aqui quando forem cadastrados pelo
              sindicato.
            </p>
          </Card.Body>
        </Card>
      )}
      <div className="portal-cancel-link">
        <Link className="btn btn-link" to="/associado/cancelamento">
          Deseja solicitar a desativação da associação? Saiba mais
        </Link>
      </div>
    </div>
  );
}

export default AssociateBenefitsPage;
