import { Card, Col, Row } from 'react-bootstrap';
import { Link } from 'react-router';
import { useTituloPagina } from '../../componentes';

const assuntos = [
  {
    id: 'beneficios',
    titulo: 'Benefícios',
    descricao:
      'Consulte os benefícios cadastrados pelo sindicato na área do associado.',
  },
  {
    id: 'convencoes',
    titulo: 'Convenções coletivas',
    descricao:
      'Acesse informações gerais, resumos e anexos das convenções coletivas.',
  },
  {
    id: 'suporte',
    titulo: 'Suporte',
    descricao:
      'Consulte as informações de suporte disponibilizadas pelo sindicato.',
  },
];

/** Vitrine pública com as informações previstas para visitantes. */
export function PaginaInicial() {
  useTituloPagina('Início');
  return (
    <div className="vitrine">
      <section
        id="inicio"
        className="vitrine-hero"
        aria-labelledby="titulo-vitrine"
      >
        <div className="vitrine-container">
          <Row className="align-items-center g-4 g-xl-5">
            <Col lg={7}>
              <span className="vitrine-selo">Elo Connect</span>
              <h1 id="titulo-vitrine">
                Informações do sindicato para farmácias associadas
              </h1>
              <p className="vitrine-resumo">
                Acesse informações sobre benefícios, convenções coletivas e
                suporte. Associados também podem entrar no portal para consultar
                boletos, notícias e outros serviços disponíveis.
              </p>
              <div className="vitrine-acoes">
                <Link className="btn btn-primary btn-lg" to="/entrar">
                  Entrar
                </Link>
                <Link className="btn btn-outline-primary btn-lg" to="/cadastro">
                  Cadastrar farmácia
                </Link>
              </div>
            </Col>
            <Col lg={5}>
              <div
                className="vitrine-foto-reservada"
                role="img"
                aria-label="Espaço reservado para uma foto"
              >
                Espaço reservado para foto
              </div>
            </Col>
          </Row>
        </div>
      </section>

      <section
        id="assuntos"
        className="vitrine-secao"
        aria-labelledby="titulo-assuntos"
      >
        <div className="vitrine-container">
          <h2 id="titulo-assuntos" className="vitrine-titulo-secao">
            O que você encontra
          </h2>
          <Row className="g-3">
            {assuntos.map((assunto) => (
              <Col key={assunto.id} md={4}>
                <Card id={assunto.id} className="vitrine-cartao-assunto h-100">
                  <Card.Body>
                    <h3>{assunto.titulo}</h3>
                    <p>{assunto.descricao}</p>
                    <Link to="/entrar">Acessar área do associado</Link>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
          <p className="vitrine-nota-acesso">
            O acesso ao portal e ao feed de notícias é exclusivo para associados
            com login.
          </p>
        </div>
      </section>
    </div>
  );
}
