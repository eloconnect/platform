import { Card, Col, Row } from 'react-bootstrap';
import { Link } from 'react-router';
import { useTituloPagina } from '../../componentes';

const beneficiosProvisorios = [
  {
    titulo: 'Benefícios para associados',
    descricao:
      'Consulte as vantagens e os serviços disponibilizados pelo sindicato.',
  },
  {
    titulo: 'Orientação sindical',
    descricao:
      'Encontre informações sobre os serviços e o suporte oferecidos pelo sindicato.',
  },
  {
    titulo: 'Informações para farmácias',
    descricao: 'Conheça os serviços disponíveis para os associados.',
  },
];

export function PaginaInicial() {
  useTituloPagina('Início');

  return (
    <>
      <section className="container py-5" aria-labelledby="titulo-inicial">
        <p className="text-primary fw-semibold mb-2">Elo Connect</p>

        <h1 id="titulo-inicial" className="display-5 fw-bold">
          Informações e serviços do sindicato
        </h1>

        <p className="lead my-4">
          Conheça os serviços do sindicato e encontre informações para sua
          farmácia.
        </p>

        <div className="d-flex flex-wrap gap-3">
          <Link to="/entrar" className="btn btn-primary btn-lg">
            Entrar
          </Link>

          <Link to="/cadastro" className="btn btn-outline-primary btn-lg">
            Criar conta
          </Link>
        </div>
      </section>

      <section className="container mb-5" aria-labelledby="titulo-beneficios">
        <h2 id="titulo-beneficios" className="h3 mb-4">
          Benefícios e serviços
        </h2>

        {/* TODO(P06): substituir pelos benefícios oficiais após a definição da P06. */}
        <Row className="g-4">
          {beneficiosProvisorios.map((beneficio) => (
            <Col key={beneficio.titulo} md={6} lg={4}>
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
      </section>

      <section className="container mb-5" aria-labelledby="titulo-convencoes">
        <h2 id="titulo-convencoes" className="h3 mb-3">
          Convenções coletivas
        </h2>

        <p>
          Entre no portal com seu e-mail e senha para consultar as informações
          disponíveis sobre convenções coletivas.
        </p>

        <Link to="/entrar" className="btn btn-outline-primary">
          Entrar para consultar
        </Link>
      </section>

      <section className="container mb-5" aria-labelledby="titulo-suporte">
        <h2 id="titulo-suporte" className="h3 mb-3">
          Suporte ao associado
        </h2>

        <p>
          Entre no portal com seu e-mail e senha para acessar os serviços e as
          informações disponibilizados pelo sindicato.
        </p>

        <Link to="/entrar" className="btn btn-outline-primary">
          Acessar o portal
        </Link>
      </section>
    </>
  );
}
