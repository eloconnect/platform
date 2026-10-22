import { useEffect, useState } from 'react';
import { Alert, Card, Col, Row, Spinner } from 'react-bootstrap';
import { Link } from 'react-router';
import type { PaginaInicialResponse } from '@eloconnect/shared';
import { api } from '../../api';
import { useTituloPagina } from '../../componentes';

/** Página pública alimentada pela API do Elo Connect. */
export function PaginaInicial() {
  useTituloPagina('Início');

  const [dados, setDados] = useState<PaginaInicialResponse | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let ativa = true;

    api
      .getPaginaInicial()
      .then((resposta) => {
        if (ativa) setDados(resposta);
      })
      .catch(() => {
        if (ativa) setErro(true);
      })
      .finally(() => {
        if (ativa) setCarregando(false);
      });

    return () => {
      ativa = false;
    };
  }, []);

  if (carregando) {
    return (
      <div className="container py-5 text-center" role="status">
        <Spinner animation="border" aria-hidden="true" />
        <p className="mt-3">Carregando informações...</p>
      </div>
    );
  }

  if (erro || !dados) {
    return (
      <main className="container py-5">
        <Alert variant="danger" role="alert">
          Não foi possível carregar as informações. Tente novamente mais tarde.
        </Alert>

        <div className="d-flex flex-wrap gap-3">
          <Link to="/entrar" className="btn btn-primary btn-lg">
            Entrar
          </Link>

          <Link to="/cadastro" className="btn btn-outline-primary btn-lg">
            Criar conta
          </Link>
        </div>
      </main>
    );
  }

  const { configuracao, beneficios, convencoes, noticias } = dados;

  return (
    <div className="container py-5">
      <section className="py-4 mb-5" aria-labelledby="titulo-inicial">
        <p className="text-primary fw-semibold mb-2">Elo Connect</p>

        <h1 id="titulo-inicial" className="display-5 fw-bold">
          {configuracao.titulo}
        </h1>

        <p className="lead my-4">{configuracao.descricao}</p>

        {configuracao.imagemUrl && (
          <img
            src={configuracao.imagemUrl}
            alt={configuracao.imagemAlt ?? ''}
            className="img-fluid rounded mb-4"
          />
        )}

        <div className="d-flex flex-wrap gap-3">
          <Link to="/entrar" className="btn btn-primary btn-lg">
            Entrar
          </Link>

          <Link to="/cadastro" className="btn btn-outline-primary btn-lg">
            Criar conta
          </Link>
        </div>
      </section>

      <section className="mb-5" aria-labelledby="titulo-beneficios">
        <h2 id="titulo-beneficios" className="h3 mb-4">
          Benefícios
        </h2>

        {beneficios.length === 0 ? (
          <p>Os benefícios serão divulgados em breve.</p>
        ) : (
          <Row className="g-4">
            {beneficios.map((beneficio) => (
              <Col key={beneficio.id} md={6} lg={4}>
                <Card className="h-100">
                  <Card.Body>
                    <Card.Title>{beneficio.titulo}</Card.Title>
                    <Card.Text>{beneficio.descricao}</Card.Text>
                    <Link to="/entrar">Acessar área do associado</Link>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </section>

      <section className="mb-5" aria-labelledby="titulo-convencoes">
        <h2 id="titulo-convencoes" className="h3 mb-4">
          Convenções coletivas
        </h2>

        {convencoes.length === 0 ? (
          <p>As convenções coletivas serão divulgadas em breve.</p>
        ) : (
          <Row className="g-4">
            {convencoes.map((convencao) => (
              <Col key={convencao.id} md={6} lg={4}>
                <Card className="h-100">
                  <Card.Body>
                    <Card.Title>{convencao.titulo}</Card.Title>
                    <Card.Subtitle className="mb-3 text-secondary">
                      Ano: {convencao.ano}
                    </Card.Subtitle>
                    <Card.Text>{convencao.resumo}</Card.Text>
                    <Link to="/entrar">Consultar convenções</Link>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </section>

      {noticias.length > 0 && (
        <section aria-labelledby="titulo-noticias">
          <h2 id="titulo-noticias" className="h3 mb-4">
            Notícias
          </h2>

          <Row className="g-4">
            {noticias.map((noticia) => (
              <Col key={noticia.id} md={6} lg={4}>
                <Card className="h-100">
                  <Card.Body>
                    <Card.Title>{noticia.titulo}</Card.Title>
                    <Card.Text>{noticia.conteudo}</Card.Text>
                    <small className="text-secondary">
                      Publicada em{' '}
                      {new Date(noticia.publicadaEm).toLocaleDateString(
                        'pt-BR',
                      )}
                    </small>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
        </section>
      )}
    </div>
  );
}
