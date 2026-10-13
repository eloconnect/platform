import { Badge, Card, Col, Row } from 'react-bootstrap';
import { Link } from 'react-router';
import { useTituloPagina } from '../../componentes';

const anoAtual = new Date().getFullYear();

const temasConvencao = [
  'Regime especial de trabalho aos domingos e feriados',
  'Índices de reajuste e bonificação por produtividade',
  'Regulamentação de vestuário e equipamentos de proteção',
];

const dadosConvencao = [
  {
    titulo: 'CCT Geral — Varejo Farmacêutico Estadual',
    descricao: 'Inclui termo aditivo e jornada de trabalho.',
    periodo: '2024 / 2025',
  },
];

const vantagens = [
  {
    titulo: 'Sem carência para suporte em fiscalizações',
    descricao:
      'Acesso ao nosso departamento jurídico desde o primeiro dia de homologação cadastral.',
  },
  {
    titulo: 'Acesso ilimitado à Sala de Decisões do Empresário',
    descricao:
      'Participe dos comitês que definem diretrizes de preços e negociações com fornecedores.',
  },
  {
    titulo: 'Selo Digital “Farmácia Filiada Conforme”',
    descricao:
      'Transmita credibilidade para vigilância sanitária e para seu consumidor.',
  },
];

function IconeDocumento() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M6 3h8l4 4v14H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm8 0v5h5m-11 4h7m-7 4h7"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function IconeAtendimento() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M4 12a8 8 0 0 1 16 0v5a2 2 0 0 1-2 2h-2v-6h4M4 13h4v6H6a2 2 0 0 1-2-2v-4Zm6 6h4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

/** Vitrine pública e institucional do Elo Connect. */
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
              <Badge bg="light" text="primary" className="vitrine-selo">
                Representação Sindical Forte &amp; Próxima
              </Badge>
              <h1 id="titulo-vitrine">
                A força que impulsiona e protege o{' '}
                <span>setor farmacêutico.</span>
              </h1>
              <p className="vitrine-resumo">
                Segurança jurídica trabalhista, negociações sindicais
                equilibradas e suporte integral para drogarias e redes crescerem
                com estabilidade financeira e conformidade legal.
              </p>
              <Link
                className="btn btn-primary btn-lg vitrine-cta"
                to="/cadastro"
              >
                Filie sua Farmácia Agora <span aria-hidden="true">→</span>
              </Link>

              <Row className="vitrine-metricas g-2">
                <Col xs={4}>
                  <Card className="vitrine-metrica h-100">
                    <Card.Body>
                      <strong>+450</strong>
                      <span>Farmácias Filiadas</span>
                      <small>Rede de associados independentes</small>
                    </Card.Body>
                  </Card>
                </Col>
                <Col xs={4}>
                  <Card className="vitrine-metrica h-100">
                    <Card.Body>
                      <strong>28 Anos</strong>
                      <span>De Tradição Patronal</span>
                      <small>Defesa e respeito no varejo</small>
                    </Card.Body>
                  </Card>
                </Col>
                <Col xs={4}>
                  <Card className="vitrine-metrica h-100">
                    <Card.Body>
                      <strong>98.4%</strong>
                      <span>Vitórias Trabalhistas</span>
                      <small>Em dissídios e mediações</small>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>
            </Col>
            <Col lg={5}>
              <div className="vitrine-foto">
                <img
                  src="/images/farmacia-equipe.png"
                  alt="Equipe de profissionais em atendimento em uma farmácia."
                  width="720"
                  height="540"
                />
                <div className="vitrine-foto-legenda">
                  <strong>Plataforma institucional do Sindicato</strong>
                  <span>
                    Assistência técnica direta para fiscalizações fiscais e
                    sanitárias.
                  </span>
                </div>
              </div>
              <a className="vitrine-atualizacao" href="#convencoes">
                <span className="vitrine-atualizacao-icone" aria-hidden="true">
                  <IconeDocumento />
                </span>
                <span>
                  <strong>Acordo Coletivo Homologado</strong>
                  <small>
                    Tabela de pisos salariais e jornadas 12x36 vigentes.
                  </small>
                </span>
                <span className="vitrine-seta" aria-hidden="true">
                  →
                </span>
              </a>
            </Col>
          </Row>
        </div>
      </section>

      <section
        id="convencoes"
        className="vitrine-secao vitrine-convencoes"
        aria-labelledby="titulo-convencoes"
      >
        <div className="vitrine-container">
          <Card className="vitrine-painel-documentos">
            <Card.Body>
              <Row className="align-items-center g-4">
                <Col lg={5}>
                  <Badge bg="light" text="primary" className="vitrine-selo">
                    Documentação Oficial
                  </Badge>
                  <h2 id="titulo-convencoes">
                    Convenções Coletivas e Pisos Vigentes
                  </h2>
                  <p className="vitrine-texto-secao">
                    Mantenha o RH e a contabilidade da sua farmácia 100%
                    atualizados. Tenha acesso às tabelas salariais
                    disponibilizadas para a categoria farmacêutica.
                  </p>
                  <ul className="vitrine-topicos">
                    {temasConvencao.map((tema, indice) => (
                      <li key={tema}>
                        <span aria-hidden="true">
                          {indice === 0 ? '◷' : indice === 1 ? '▤' : '♧'}
                        </span>
                        {tema}
                      </li>
                    ))}
                  </ul>
                </Col>
                <Col lg={7}>
                  <div className="vitrine-tabela">
                    <div className="vitrine-tabela-cabecalho">
                      <span>Norma Sindical</span>
                      <span>Exercício</span>
                      <span>Ação</span>
                    </div>
                    {dadosConvencao.map((documento) => (
                      <div className="vitrine-documento" key={documento.titulo}>
                        <span
                          className="vitrine-documento-icone"
                          aria-hidden="true"
                        >
                          <IconeDocumento />
                        </span>
                        <span className="vitrine-documento-titulo">
                          <strong>{documento.titulo}</strong>
                          <small>{documento.descricao}</small>
                        </span>
                        <span className="vitrine-periodo">
                          {documento.periodo}
                        </span>
                        <Link
                          className="btn btn-primary vitrine-download"
                          to="/entrar"
                          aria-label={`Entrar para consultar: ${documento.titulo}`}
                        >
                          Acessar
                        </Link>
                      </div>
                    ))}
                  </div>
                  <p className="vitrine-nota-documentos">
                    O acesso aos documentos oficiais é disponibilizado pelo
                    portal do associado.
                  </p>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </div>
      </section>

      <section
        id="atuacao"
        className="vitrine-secao vitrine-filiacao"
        aria-labelledby="titulo-filiacao"
      >
        <div className="vitrine-container">
          <Row className="align-items-center g-4">
            <Col lg={6}>
              <Badge bg="light" text="primary" className="vitrine-selo">
                Filiação Simplificada &amp; Imediata
              </Badge>
              <h2 id="titulo-filiacao">
                Fortaleça o seu negócio. Seja parte do sindicato que luta pela
                sua farmácia.
              </h2>
              <p className="vitrine-texto-secao">
                Com mensalidade institucional ajustada ao porte do seu
                estabelecimento, o retorno em economia com honorários jurídicos
                e multas evitadas cobre seu investimento logo nos primeiros
                meses.
              </p>
              <ul className="vitrine-vantagens">
                {vantagens.map((vantagem) => (
                  <li key={vantagem.titulo}>
                    <span aria-hidden="true">✓</span>
                    <span>
                      <strong>{vantagem.titulo}</strong>
                      <small>{vantagem.descricao}</small>
                    </span>
                  </li>
                ))}
              </ul>
            </Col>
            <Col lg={6}>
              <Card className="vitrine-formulario">
                <Card.Body>
                  <div className="vitrine-formulario-titulo">
                    <span>
                      <strong>Simular e Solicitar Filiação</strong>
                      <small>Inicie seu cadastro institucional</small>
                    </span>
                    <Badge bg="primary">Rápido em 2 minutos</Badge>
                  </div>
                  <p className="vitrine-campos-previa">
                    CNPJ da Farmácia ou Drogaria
                  </p>
                  <div className="vitrine-campo-fantasma">
                    00.000.000/0001-00
                  </div>
                  <Row className="g-2">
                    <Col xs={6}>
                      <p className="vitrine-campos-previa">
                        Nome do Responsável / Diretor
                      </p>
                      <div className="vitrine-campo-fantasma">
                        Ex.: Dr. Roberto Mendes
                      </div>
                    </Col>
                    <Col xs={6}>
                      <p className="vitrine-campos-previa">
                        WhatsApp Direto para Contato
                      </p>
                      <div className="vitrine-campo-fantasma">
                        (11) 99999-9999
                      </div>
                    </Col>
                  </Row>
                  <Link
                    className="btn btn-primary w-100 vitrine-enviar"
                    to="/cadastro"
                  >
                    Enviar solicitação de filiação
                  </Link>
                  <p className="vitrine-privacidade">
                    Seus dados corporativos estão protegidos pela LGPD (Lei
                    13.709/18).
                  </p>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </div>
      </section>

      <footer id="contato" className="vitrine-rodape">
        <div className="vitrine-container">
          <Row className="g-4">
            <Col sm={6} lg={3}>
              <Link className="vitrine-rodape-marca" to="/">
                Elo Connect
              </Link>
              <p>
                Entidade sindical patronal dedicada à representação, defesa e
                orientação do comércio farmacêutico.
              </p>
              <div className="vitrine-siglas" aria-label="Estados atendidos">
                <span>MT</span>
              </div>
            </Col>
            <Col sm={6} lg={3}>
              <h2>Central de Atendimento</h2>
              <p>☎ &nbsp; 0800 724 4500</p>
              <p>▣ &nbsp; Atendimento em horário comercial</p>
              <Link to="/entrar">Acessar minha área</Link>
            </Col>
            <Col sm={6} lg={3}>
              <h2>Sede Administrativa</h2>
              <p>
                Sindicato das farmácias e drogarias de Mato Grosso.
                <br />
                Atendimento institucional em horário comercial.
              </p>
              <Link to="/entrar">Acessar minha área</Link>
            </Col>
            <Col sm={6} lg={3}>
              <h2>Urgências e Notificações</h2>
              <p>
                Receba atualizações e comunicados institucionais da categoria.
              </p>
              <a
                className="vitrine-botao-alertas"
                href="tel:08007244500"
                aria-label="Ligar para o Plantão Trabalhista no 0800 724 4500"
              >
                <IconeAtendimento />
                Plantão Trabalhista
              </a>
            </Col>
          </Row>
        </div>
        <div className="vitrine-rodape-base">
          <div className="vitrine-container vitrine-rodape-base-conteudo">
            <strong>Elo Connect</strong>
            <nav aria-label="Links do rodapé">
              <a href="#convencoes">Normas coletivas</a>
              <a href="#atuacao">Orientação sindical</a>
              <a href="#contato">Atendimento</a>
            </nav>
            <small>
              © {anoAtual} Elo Connect. Todos os direitos reservados.
            </small>
          </div>
        </div>
      </footer>
    </div>
  );
}
