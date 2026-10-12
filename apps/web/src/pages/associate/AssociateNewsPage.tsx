import { useEffect, useState } from 'react';
import { Alert, Card, Spinner } from 'react-bootstrap';
import { AuthApiError, getMemberNews, type MemberNews } from '../../lib/auth';

function AssociateNewsPage() {
  const [news, setNews] = useState<MemberNews[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    getMemberNews()
      .then((result) => {
        if (mounted) setNews(result);
      })
      .catch((requestError: unknown) => {
        if (!mounted) return;
        setError(
          requestError instanceof AuthApiError
            ? requestError.message
            : 'Não foi possível carregar as notícias.',
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
          <p className="portal-kicker">INFORMAÇÕES DA CATEGORIA</p>
          <h1>Notícias</h1>
          <p>Acompanhe comunicados e atualizações publicados pelo sindicato.</p>
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
          Carregando notícias...
        </div>
      ) : news.length ? (
        <div className="portal-news-list">
          {news.map((item) => (
            <Card className="portal-news-card" key={item.id}>
              <Card.Body>
                {item.publishedAt && (
                  <p className="portal-kicker">
                    {new Intl.DateTimeFormat('pt-BR', {
                      dateStyle: 'long',
                    }).format(new Date(item.publishedAt))}
                  </p>
                )}
                <h2>{item.title}</h2>
                <p className="portal-news-content">{item.content}</p>
              </Card.Body>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="portal-empty-card">
          <Card.Body>
            <h2>Nenhuma notícia publicada</h2>
            <p>Os comunicados do sindicato aparecerão aqui.</p>
          </Card.Body>
        </Card>
      )}
    </div>
  );
}

export default AssociateNewsPage;
