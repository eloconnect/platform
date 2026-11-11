import type { Beneficio } from '@eloconnect/shared';
import { GRUPOS_BENEFICIO, TEXTO_GRUPO_BENEFICIO } from '@eloconnect/shared';
import { useEffect, useState } from 'react';
import { Card, Col, Container, Row } from 'react-bootstrap';
import { Link } from 'react-router';
import { api } from '../../api';
import fotoAtendimento from '../../assets/fotos/atendimento-balcao.webp';
import fotoFarmaceutico from '../../assets/fotos/farmaceutico-prateleira.webp';
import { Icone, useTituloPagina, type NomeIcone } from '../../componentes';

type EstadoBeneficios = Beneficio[] | 'carregando' | 'erro';

/** O que o sindicato oferece no sistema (RF01). */
const OFERTAS: { icone: NomeIcone; titulo: string; texto: string }[] = [
  {
    icone: 'documento',
    titulo: 'Convenções coletivas',
    texto: 'As convenções do setor, para consultar quando precisar.',
  },
  {
    icone: 'conversa',
    titulo: 'Suporte ao associado',
    texto: 'Apoio da sede para a sua farmácia, com a contribuição em dia.',
  },
  {
    icone: 'boleto',
    titulo: 'Boleto da contribuição',
    texto: 'Boleto com Pix e lembrete por e-mail antes do vencimento.',
  },
  {
    icone: 'noticia',
    titulo: 'Notícias',
    texto: 'Avisos e novidades do sindicato para todos os associados.',
  },
];

export function PaginaInicial() {
  useTituloPagina('Início');
  // Cadastrados pela sede, em dois grupos (RF24, RN32).
  const [beneficios, setBeneficios] = useState<EstadoBeneficios>('carregando');

  useEffect(() => {
    let ativo = true;
    void api
      .listarBeneficios()
      .then((lista) => ativo && setBeneficios(lista))
      .catch(() => ativo && setBeneficios('erro'));
    return () => {
      ativo = false;
    };
  }, []);

  // TODO(P19): o sindicato vai informar o e-mail. Ele fica na configuração da
  // hospedagem, nunca no repositório (RNF10).
  const emailPedidoCadastro = import.meta.env.VITE_EMAIL_PEDIDO_CADASTRO;

  return (
    <>
      <section className="elo-abertura" aria-labelledby="titulo-inicial">
        <Container>
          <Row className="align-items-center g-5">
            <Col lg={6}>
              <p className="elo-sobrelinha">
                Sindicato das farmácias e drogarias de Mato Grosso
              </p>
              <h1 id="titulo-inicial" className="elo-display">
                Tudo do sindicato, num lugar só.
              </h1>
              <p className="lead mb-4">
                Convenções, benefícios, notícias e o boleto da contribuição.
              </p>
              <div className="d-flex flex-wrap gap-3">
                <Link to="/entrar" className="btn btn-primary btn-lg">
                  Entrar
                  <Icone nome="seta" />
                </Link>
                <Link to="/cadastro" className="btn btn-outline-primary btn-lg">
                  Criar conta
                </Link>
              </div>
            </Col>
            <Col lg={6}>
              <div className="elo-foto">
                <img
                  src={fotoAtendimento}
                  alt="Farmacêutica ajuda uma cliente a conferir um produto no balcão."
                  width={1280}
                  height={852}
                  fetchPriority="high"
                />
                {/* RN08 */}
                <p className="elo-foto-nota">
                  <Icone nome="visto" />
                  Sem juros e sem multa por atraso
                </p>
              </div>
            </Col>
          </Row>
        </Container>
      </section>

      <section
        className="elo-faixa elo-faixa--branca"
        aria-labelledby="titulo-ofertas"
      >
        <Container>
          <h2 id="titulo-ofertas" className="mb-4">
            O que você encontra aqui
          </h2>
          <Row as="ul" className="list-unstyled g-4 mb-0">
            {OFERTAS.map((oferta) => (
              <Col as="li" key={oferta.titulo} md={6}>
                <div className="elo-oferta">
                  <span className="elo-picto">
                    <Icone nome={oferta.icone} />
                  </span>
                  <div>
                    <h3>{oferta.titulo}</h3>
                    <p>{oferta.texto}</p>
                  </div>
                </div>
              </Col>
            ))}
          </Row>
        </Container>
      </section>

      <section className="elo-faixa" aria-labelledby="titulo-beneficios">
        <Container>
          <h2 id="titulo-beneficios" className="mb-2">
            Benefícios e serviços
          </h2>
          <p className="text-body-secondary mb-4">
            Para as farmácias com a contribuição em dia.
          </p>

          {beneficios === 'carregando' && <p>Carregando os benefícios...</p>}
          {beneficios === 'erro' && (
            <p>
              Não foi possível carregar os benefícios agora. Tente de novo em
              alguns minutos.
            </p>
          )}
          {Array.isArray(beneficios) && beneficios.length === 0 && (
            <p>
              Os benefícios do sindicato aparecem aqui assim que forem
              cadastrados.
            </p>
          )}
          {Array.isArray(beneficios) &&
            GRUPOS_BENEFICIO.map((grupo) => {
              const doGrupo = beneficios.filter((b) => b.grupo === grupo);
              if (doGrupo.length === 0) return null;
              return (
                <div key={grupo} className="mb-4">
                  <h3 className="mb-3">{TEXTO_GRUPO_BENEFICIO[grupo]}</h3>
                  <Row className="g-4">
                    {doGrupo.map((beneficio) => (
                      <Col key={beneficio.id} md={6} lg={4}>
                        <Card className="h-100">
                          <Card.Body>
                            <Card.Title as="h4" className="h5">
                              {beneficio.titulo}
                            </Card.Title>
                            <Card.Text className="texto-com-quebras">
                              {beneficio.descricao}
                            </Card.Text>
                          </Card.Body>
                        </Card>
                      </Col>
                    ))}
                  </Row>
                </div>
              );
            })}
        </Container>
      </section>

      <section
        className="elo-faixa elo-faixa--clara"
        aria-labelledby="titulo-passos"
      >
        <Container>
          <Row className="align-items-center g-5">
            <Col lg={6} className="order-lg-2">
              <h2 id="titulo-passos" className="mb-4">
                Criar a conta em 3 passos
              </h2>
              <ol className="elo-passos">
                <li>
                  <span className="elo-passo-numero" aria-hidden="true">
                    1
                  </span>
                  <div>
                    <h3>Informe o CNPJ</h3>
                    <p>Digite o CNPJ da farmácia na tela “Criar conta”.</p>
                  </div>
                </li>
                <li>
                  <span className="elo-passo-numero" aria-hidden="true">
                    2
                  </span>
                  <div>
                    <h3>Abra o link do e-mail</h3>
                    <p>O link chega no e-mail que está no cadastro.</p>
                  </div>
                </li>
                <li>
                  <span className="elo-passo-numero" aria-hidden="true">
                    3
                  </span>
                  <div>
                    <h3>Crie a sua senha</h3>
                    <p>Depois, é só entrar com o e-mail e a senha.</p>
                  </div>
                </li>
              </ol>
              <Link to="/cadastro" className="btn btn-primary btn-lg">
                Criar conta
              </Link>
            </Col>
            <Col lg={6} className="order-lg-1">
              <div className="elo-foto">
                <img
                  src={fotoFarmaceutico}
                  alt=""
                  width={960}
                  height={639}
                  loading="lazy"
                />
              </div>
            </Col>
          </Row>
        </Container>
      </section>

      <section className="elo-faixa">
        <Container>
          <aside
            className="elo-aviso-cadastro"
            aria-labelledby="titulo-pedido-cadastro"
          >
            <span className="elo-picto">
              <Icone nome="email" />
            </span>
            <div>
              <h2 id="titulo-pedido-cadastro" className="h3">
                Sua farmácia ainda não está no cadastro do sindicato?
              </h2>
              <p className="mb-0">
                {emailPedidoCadastro ? (
                  <>
                    Peça o cadastro pelo e-mail{' '}
                    <a href={`mailto:${emailPedidoCadastro}`}>
                      {emailPedidoCadastro}
                    </a>
                    .
                  </>
                ) : (
                  'Peça o cadastro à sede do sindicato.'
                )}{' '}
                Depois do cadastro, é só criar a conta com o CNPJ da farmácia.
              </p>
            </div>
          </aside>
        </Container>
      </section>
    </>
  );
}
