import { Link } from 'react-router';
import { useTituloPagina } from '../../componentes';
import { Badge, Card, Col, Row } from 'react-bootstrap';

const apoios = [
  {
    titulo: 'Convenções coletivas',
    descricao:
      'Consulte informações e orientações sobre as convenções da categoria.',
  },
  {
    titulo: 'Orientação sindical',
    descricao:
      'Encontre informações para apoiar a rotina da sua farmácia ou drogaria.',
  },
  {
    titulo: 'Suporte para associados',
    descricao:
      'Acesse os serviços e os canais de atendimento do sindicato em um só lugar.',
  },
];

export function PaginaInicial() {
  useTituloPagina('Início');

  return (
    <div className="pagina-inicial">
      <section
        className="inicio-hero p-4 p-lg-5 mb-5"
        aria-labelledby="titulo-inicio"
      >
        <Row className="align-items-center g-4">
          <Col lg={8}>
            <p className="fw-semibold mb-2">
              Para farmácias e drogarias de Mato Grosso
            </p>
            <h1 id="titulo-inicio" className="display-5 fw-bold">
              Informação e apoio para fortalecer o setor farmacêutico
            </h1>
            <p className="lead mt-3 mb-4">
              O Elo Connect reúne informações sobre convenções coletivas,
              atuação sindical e serviços para apoiar a gestão da sua farmácia.
            </p>
            <div className="d-flex flex-wrap gap-3">
              <Link className="btn btn-light btn-lg" to="/entrar">
                Entrar
              </Link>
              <Link className="btn btn-outline-light btn-lg" to="#cadastro">
                Criar conta
              </Link>
            </div>
          </Col>
          <Col lg={4}>
            <Card className="inicio-destaque border-0 h-100">
              <Card.Body className="p-4">
                <p className="text-primary fw-semibold mb-2">Elo Connect</p>
                <h2 className="h3">Mais informação para o seu dia a dia</h2>
                <p className="mb-0">
                  Acompanhe conteúdos e serviços preparados para a categoria
                  farmacêutica.
                </p>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </section>

      <section className="mb-5" aria-labelledby="titulo-apoios">
        <div className="mb-4">
          <h2 id="titulo-apoios">Como o sindicato pode apoiar sua farmácia</h2>
          <p className="mb-0">
            Conheça os temas e serviços reunidos para farmácias e drogarias.
          </p>
        </div>
        <Row className="g-3">
          {apoios.map((apoio) => (
            <Col key={apoio.titulo} md={6} xl={4}>
              <Card className="h-100 inicio-card">
                <Card.Body className="p-4">
                  <h3 className="h4">{apoio.titulo}</h3>
                  <p className="mb-0">{apoio.descricao}</p>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      </section>

      <section className="mb-5" aria-labelledby="titulo-beneficios">
        <Badge bg="light" text="primary" className="mb-2">
          Conteúdo provisório
        </Badge>
        <h2 id="titulo-beneficios">Benefícios e serviços</h2>
        <p>
          A lista oficial de benefícios ainda está em definição. As informações
          serão atualizadas quando forem confirmadas pelo sindicato.
        </p>
      </section>

      <section
        id="cadastro"
        className="cadastro-info p-4 p-lg-5 rounded-3"
        aria-labelledby="titulo-cadastro"
      >
        <h2 id="titulo-cadastro">Ainda não tem acesso?</h2>
        <p>
          A criação de contas pelo portal está em preparação. Enquanto isso,
          você pode entrar se já possui acesso ao Elo Connect.
        </p>
        <Link className="btn btn-primary btn-lg" to="/entrar">
          Ir para o login
        </Link>
      </section>
    </div>
  );
}
