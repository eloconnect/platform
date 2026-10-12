import { useEffect, useState } from 'react';
import { Alert, Button, Card, Spinner } from 'react-bootstrap';
import {
  AuthApiError,
  getMemberSupport,
  type MemberSupport,
} from '../../lib/auth';

function AssociateSupportPage() {
  const [support, setSupport] = useState<MemberSupport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    getMemberSupport()
      .then((result) => {
        if (mounted) setSupport(result);
      })
      .catch((requestError: unknown) => {
        if (!mounted) return;
        setError(
          requestError instanceof AuthApiError
            ? requestError.message
            : 'Não foi possível carregar os canais de suporte.',
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
      <div className="portal-page-heading">
        <div>
          <p className="portal-kicker">ATENDIMENTO AO ASSOCIADO</p>
          <h1>Benefícios &amp; suporte</h1>
          <p>
            Entre em contato com a equipe para orientações sobre os serviços
            sindicais.
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
          Carregando atendimento...
        </div>
      ) : support ? (
        <Card className="portal-support-card">
          <Card.Body>
            <span aria-hidden="true" className="portal-icon">
              ☎
            </span>
            <p className="portal-kicker">CENTRAL NACIONAL</p>
            <h2>{support.phone}</h2>
            <p>{support.hours}</p>
            <Button as="a" href={`tel:${support.phone.replace(/\D/g, '')}`}>
              Ligar para a central
            </Button>
          </Card.Body>
        </Card>
      ) : null}
    </div>
  );
}

export default AssociateSupportPage;
