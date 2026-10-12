import { useState, type FormEvent } from 'react';
import { Alert, Button, Card, Form } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { AuthApiError, requestMemberCancellation } from '../../lib/auth';
import { useAssociatePortal } from './AssociatePortalLayout';

function AssociateCancellationPage() {
  const { overview, refreshOverview } = useAssociatePortal();
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const result = await requestMemberCancellation();
      await refreshOverview();
      navigate('/associado', {
        replace: true,
        state: { cancellationMessage: result.message },
      });
    } catch (requestError) {
      setError(
        requestError instanceof AuthApiError
          ? requestError.message
          : 'Não foi possível concluir a desativação. Tente novamente.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="portal-page portal-cancellation-page">
      <Link className="portal-back-link" to="/associado">
        ← Voltar ao início
      </Link>
      <Card className="portal-cancellation-intro">
        <Card.Body>
          <span className="portal-cancellation-alert" aria-hidden="true">
            !
          </span>
          <div>
            <p className="portal-kicker">ATENÇÃO AO RESPONSÁVEL</p>
            <h1>Desativação da associação</h1>
            <p>
              Ao confirmar, sua associação será desativada imediatamente. Você
              ainda poderá entrar na conta e consultar boletos e pagamentos, mas
              perderá o acesso aos benefícios, convenções coletivas e suporte
              técnico.
            </p>
          </div>
        </Card.Body>
      </Card>

      <Card className="portal-cancellation-details">
        <Card.Body>
          <h2>Serviços interrompidos após a desativação:</h2>
          <ul>
            <li>
              <strong>Assessoria jurídica trabalhista</strong>
              <span>
                O acesso à orientação jurídica vinculada à associação será
                encerrado.
              </span>
            </li>
            <li>
              <strong>Benefícios e condições comerciais</strong>
              <span>
                Descontos e serviços exclusivos para associados deixarão de
                estar disponíveis.
              </span>
            </li>
            <li>
              <strong>Convenções coletivas</strong>
              <span>
                O acesso aos documentos e serviços destinados aos associados
                será bloqueado.
              </span>
            </li>
            <li>
              <strong>Suporte técnico e atendimento</strong>
              <span>
                Os canais de atendimento exclusivos para associados serão
                desabilitados.
              </span>
            </li>
          </ul>
        </Card.Body>
      </Card>

      {overview.access.support && (
        <Card className="portal-cancellation-contact">
          <Card.Body>
            <div>
              <p className="portal-kicker">PRECISA DE AJUDA?</p>
              <h2>Quer conversar antes de desativar?</h2>
              <p>
                A equipe pode orientar você sobre contribuições e serviços da
                associação.
              </p>
            </div>
            <Link className="btn btn-primary" to="/associado/suporte">
              Falar com o suporte
            </Link>
          </Card.Body>
        </Card>
      )}

      {overview.associate.recurringBilling && (
        <Alert variant="info">
          Ao confirmar, a cobrança recorrente será desativada junto com a
          associação. Boletos que já foram emitidos continuarão disponíveis na
          sua conta.
        </Alert>
      )}
      {error && (
        <Alert variant="danger" role="alert">
          {error}
        </Alert>
      )}

      <Card className="portal-cancellation-confirm">
        <Card.Body>
          <h2>Confirmação</h2>
          <p>
            Esta ação é imediata. Sua conta de acesso continuará ativa para
            consulta de boletos e pagamentos.
          </p>
          <Form onSubmit={handleSubmit}>
            <Form.Check
              id="confirm-association-deactivation"
              label="Estou ciente de que a associação e o acesso a benefícios, convenções e suporte serão desativados imediatamente."
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              required
            />
            <Button
              className="w-100 mt-3"
              type="submit"
              variant="danger"
              disabled={!confirmed || submitting}
            >
              {submitting
                ? 'Desativando...'
                : 'Confirmar desativação da associação'}
            </Button>
          </Form>
        </Card.Body>
      </Card>
    </div>
  );
}

export default AssociateCancellationPage;
