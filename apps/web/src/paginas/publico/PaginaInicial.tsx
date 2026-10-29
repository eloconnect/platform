import type { Beneficio } from '@eloconnect/shared';
import { GRUPOS_BENEFICIO, TEXTO_GRUPO_BENEFICIO } from '@eloconnect/shared';
import { useEffect, useState } from 'react';
import { Card, Col, Row } from 'react-bootstrap';
import { Link } from 'react-router';
import { api } from '../../api';
import { useTituloPagina } from '../../componentes';

type EstadoBeneficios = Beneficio[] | 'carregando' | 'erro';

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

        <aside
          className="border rounded p-4 mt-5"
          aria-labelledby="titulo-pedido-cadastro"
        >
          <h2 id="titulo-pedido-cadastro" className="h4">
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
        </aside>
      </section>

      <section className="container mb-5" aria-labelledby="titulo-beneficios">
        <h2 id="titulo-beneficios" className="h3 mb-4">
          Benefícios e serviços
        </h2>

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
                <h3 className="h4 mb-3">{TEXTO_GRUPO_BENEFICIO[grupo]}</h3>
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

                          <Link to="/entrar">Acessar área do associado</Link>
                        </Card.Body>
                      </Card>
                    </Col>
                  ))}
                </Row>
              </div>
            );
          })}
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
