import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Row, Spinner } from 'react-bootstrap';
import { useOutletContext } from 'react-router-dom';
import { AuthApiError, getMemberBills, type MemberBill } from '../../lib/auth';
import type { MemberOverview } from '../../lib/auth';

function currency(amount: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(amount);
}

function date(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(
    new Date(`${value.slice(0, 10)}T12:00:00`),
  );
}

function statusLabel(status: string) {
  return (
    {
      EM_ABERTO: 'Em aberto',
      VENCIDO: 'Vencido',
      PAGO: 'Pago',
      CANCELADO: 'Cancelado',
      RASCUNHO: 'Em preparação',
    }[status] ?? status
  );
}

function AssociateBillsPage() {
  const { overview } = useOutletContext<{ overview: MemberOverview }>();
  const [bills, setBills] = useState<MemberBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedBill, setCopiedBill] = useState('');

  useEffect(() => {
    let mounted = true;
    getMemberBills()
      .then((result) => {
        if (mounted) setBills(result);
      })
      .catch((requestError: unknown) => {
        if (!mounted) return;
        setError(
          requestError instanceof AuthApiError
            ? requestError.message
            : 'Não foi possível carregar os boletos.',
        );
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  async function copyPix(bill: MemberBill) {
    if (!bill.pixPayload) return;
    try {
      await navigator.clipboard.writeText(bill.pixPayload);
      setCopiedBill(bill.id);
    } catch {
      setError('Não foi possível copiar o código PIX neste navegador.');
    }
  }

  return (
    <div className="portal-page">
      <div className="portal-page-heading">
        <div>
          <p className="portal-kicker">CONTRIBUIÇÃO SINDICAL</p>
          <h1>Contribuições e boletos</h1>
          <p>
            Consulte os boletos e o histórico de pagamentos da sua farmácia.
          </p>
        </div>
      </div>

      <Row className="g-3">
        <Col md={6}>
          <Card className="portal-payment-option h-100">
            <Card.Body>
              <span aria-hidden="true" className="portal-icon">
                ↻
              </span>
              <h2>Contribuição mensal recorrente</h2>
              <p>
                {overview.associate.recurringBilling
                  ? 'O cadastro indica cobrança recorrente; nenhum pagamento automático é processado enquanto a integração bancária não estiver configurada.'
                  : 'Receba a contribuição mensal automaticamente após configurar a cobrança.'}
              </p>
              <Button disabled title="Aguardando integração de cobrança">
                {overview.associate.recurringBilling
                  ? 'Recorrência marcada no cadastro'
                  : 'Ativação disponível em breve'}
              </Button>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6}>
          <Card className="portal-payment-option h-100">
            <Card.Body>
              <span aria-hidden="true" className="portal-icon">
                ▣
              </span>
              <h2>Boleto de contribuição avulsa</h2>
              <p>
                Os boletos já emitidos aparecem abaixo. A emissão de um novo
                boleto será disponibilizada após a integração bancária.
              </p>
              <Button disabled title="Aguardando integração bancária">
                Solicitar boleto
              </Button>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {error && (
        <Alert variant="danger" role="alert">
          {error}
        </Alert>
      )}
      {copiedBill && (
        <Alert variant="success" role="status">
          Código PIX copiado.
        </Alert>
      )}
      {loading ? (
        <div className="portal-inline-loading">
          <Spinner animation="border" />
          Carregando boletos...
        </div>
      ) : bills.length ? (
        <div className="portal-bills-list">
          {bills.map((bill) => (
            <Card className="portal-bill-record" key={bill.id}>
              <Card.Body>
                <div className="portal-bill-record-heading">
                  <div>
                    <p className="portal-kicker">
                      {bill.identifier.startsWith('DEMO-')
                        ? 'BOLETO DEMONSTRATIVO'
                        : 'CONTRIBUIÇÃO SINDICAL'}
                    </p>
                    <h2>{bill.identifier}</h2>
                  </div>
                  <Badge
                    bg={
                      bill.status === 'PAGO'
                        ? 'success'
                        : bill.status === 'VENCIDO'
                          ? 'danger'
                          : 'primary'
                    }
                  >
                    {statusLabel(bill.status)}
                  </Badge>
                </div>
                <dl className="portal-bill-details">
                  <div>
                    <dt>Valor</dt>
                    <dd>{currency(bill.amount)}</dd>
                  </div>
                  <div>
                    <dt>Vencimento</dt>
                    <dd>{date(bill.dueDate)}</dd>
                  </div>
                </dl>
                {bill.identifier.startsWith('DEMO-') && (
                  <Alert variant="info">
                    Este registro fictício serve apenas para testar a tela. Não
                    contém código PIX nem boleto bancário e não pode ser pago.
                  </Alert>
                )}
                <div className="portal-button-row">
                  {bill.pixPayload && (
                    <Button onClick={() => void copyPix(bill)}>
                      Copiar código PIX
                    </Button>
                  )}
                  {bill.pdfUrl && (
                    <a
                      className="btn btn-outline-primary"
                      href={bill.pdfUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Baixar boleto em PDF
                    </a>
                  )}
                  {!bill.pixPayload &&
                    !bill.pdfUrl &&
                    !bill.identifier.startsWith('DEMO-') && (
                      <Button
                        disabled
                        title="Aguardando integração de pagamento"
                      >
                        Pagamento indisponível
                      </Button>
                    )}
                </div>
                {bill.transactions.length > 0 && (
                  <div className="portal-payment-history">
                    <h3>Movimentações</h3>
                    {bill.transactions.map((transaction) => (
                      <p
                        key={`${transaction.occurredAt}-${transaction.status}`}
                      >
                        {date(transaction.occurredAt)} ·{' '}
                        {statusLabel(transaction.status)} ·{' '}
                        {currency(transaction.amount)}
                      </p>
                    ))}
                  </div>
                )}
              </Card.Body>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="portal-empty-card">
          <Card.Body>
            <span aria-hidden="true" className="portal-icon">
              ▣
            </span>
            <h2>Nenhum boleto disponível</h2>
            <p>
              Quando um boleto for cadastrado para sua associação, ele aparecerá
              aqui.
            </p>
          </Card.Body>
        </Card>
      )}
    </div>
  );
}

export default AssociateBillsPage;
