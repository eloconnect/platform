import { Card, Col, Row } from 'react-bootstrap';
import { Link } from 'react-router';
import { useTituloPagina } from '../../componentes';
// TODO(P06): substituir os benefícios provisórios pela lista oficial
// definida com o cliente e gerenciada pelo painel administrativo.
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
    descricao:
      'Acesse o portal para consultar os serviços disponíveis aos associados.',
  },
];

export function PaginaInicial() {
  useTituloPagina('Início');

  return (
    <main className="container py-5">
      <section className="py-4 mb-5" aria-labelledby="titulo-inicial">
        <p className="text-primary fw-semibold mb-2">Elo Connect</p>

        <h1 id="titulo-inicial" className="display-5 fw-bold">
          Informações e serviços do sindicato
        </h1>

        <p className="lead my-4">
          Conheça os benefícios, saiba mais sobre as convenções coletivas e
          encontre suporte para sua farmácia.
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

      <section className="mb-5" aria-labelledby="titulo-beneficios">
        <h2 id="titulo-beneficios" className="h3 mb-4">
          Benefícios e serviços
        </h2>

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

      <section className="mb-5" aria-labelledby="titulo-convencoes">
        <h2 id="titulo-convencoes" className="h3 mb-3">
          Convenções coletivas
        </h2>

        <p>
          O portal oferece acesso às informações sobre convenções coletivas para
          usuários autenticados.
        </p>

        <Link to="/entrar" className="btn btn-outline-primary">
          Entrar para consultar
        </Link>
      </section>

      <section aria-labelledby="titulo-suporte">
        <h2 id="titulo-suporte" className="h3 mb-3">
          Suporte ao associado
        </h2>

        <p>
          Entre no portal para acessar os serviços e as informações
          disponibilizados pelo sindicato.
        </p>

        <Link to="/entrar" className="btn btn-outline-primary">
          Acessar o portal
        </Link>
      </section>
    </main>
  );
}
