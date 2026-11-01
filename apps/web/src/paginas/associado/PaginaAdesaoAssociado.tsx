import type { SituacaoAdesao } from '@eloconnect/shared';
import { ApiError, formatarReais, TERMO_ADESAO } from '@eloconnect/shared';
import { useEffect, useState, type FormEvent } from 'react';
import Card from 'react-bootstrap/Card';
import Form from 'react-bootstrap/Form';
import { Link, useNavigate } from 'react-router';
import { api } from '../../api';
import { Botao, MensagemErro, useTituloPagina } from '../../componentes';

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'erro' }
  | { tipo: 'ok'; situacao: SituacaoAdesao };

/**
 * Adesão à cobrança recorrente pelo associado (US33: RF36, RN23): o valor, o
 * termo de adesão e um botão de confirmar. A adesão vale na hora, sem
 * aprovação da sede, e o boleto deste mês sai na hora.
 */
export function PaginaAdesaoAssociado() {
  useTituloPagina('Receber o boleto todo mês');
  const navegar = useNavigate();
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' });
  const [aceito, setAceito] = useState(false);
  const [erroAceite, setErroAceite] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    void api
      .situacaoAdesao()
      .then((situacao) => ativo && setEstado({ tipo: 'ok', situacao }))
      .catch(() => ativo && setEstado({ tipo: 'erro' }));
    return () => {
      ativo = false;
    };
  }, []);

  async function aderir(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!aceito) {
      setErroAceite('Para aderir, marque que leu e aceita o termo.');
      return;
    }
    setErroAceite(undefined);
    setErro(null);
    setEnviando(true);
    try {
      const { boletoGerado } = await api.aderir({
        versaoTermo: TERMO_ADESAO.versao,
      });
      void navegar('/associado/boletos', {
        state: {
          aviso: boletoGerado
            ? 'Pronto! A partir de agora, a farmácia recebe o boleto todo mês. O boleto deste mês está aqui e também vai por e-mail.'
            : 'Pronto! A partir de agora, a farmácia recebe o boleto todo mês.',
        },
      });
    } catch (e) {
      setErro(
        e instanceof ApiError && e.status < 500
          ? e.message
          : 'Não foi possível aderir agora. Tente de novo em alguns minutos.',
      );
      setEnviando(false);
    }
  }

  return (
    <>
      <h1>Receber o boleto todo mês</h1>
      {estado.tipo === 'carregando' && <p role="status">Carregando...</p>}
      {estado.tipo === 'erro' && (
        <MensagemErro>
          Não foi possível carregar a adesão agora. Tente de novo em alguns
          minutos.
        </MensagemErro>
      )}
      {estado.tipo === 'ok' && estado.situacao.recebeBoletoMensal && (
        <>
          <p>A farmácia já recebe o boleto todo mês.</p>
          <Link className="btn btn-primary btn-lg" to="/associado/boletos">
            Ver meus boletos
          </Link>
        </>
      )}
      {estado.tipo === 'ok' &&
        !estado.situacao.recebeBoletoMensal &&
        !estado.situacao.valorMensal && (
          <p>
            A adesão ainda não está disponível. Fale com a sede do sindicato.
          </p>
        )}
      {estado.tipo === 'ok' &&
        !estado.situacao.recebeBoletoMensal &&
        estado.situacao.valorMensal && (
          <Form noValidate onSubmit={(evento) => void aderir(evento)}>
            <p className="fs-3">
              <strong>
                Valor: {formatarReais(estado.situacao.valorMensal)} por mês
              </strong>
            </p>
            <Card className="mb-4">
              <Card.Body>
                <Card.Title as="h2" className="h4">
                  Termo de adesão
                </Card.Title>
                {TERMO_ADESAO.paragrafos.map((paragrafo) => (
                  <Card.Text key={paragrafo}>{paragrafo}</Card.Text>
                ))}
              </Card.Body>
            </Card>
            <Form.Group className="mb-4" controlId="aceite-termo">
              <Form.Check
                type="checkbox"
                label="Li e aceito o termo de adesão"
                checked={aceito}
                isInvalid={erroAceite !== undefined}
                feedback={erroAceite}
                feedbackType="invalid"
                onChange={(evento) => setAceito(evento.currentTarget.checked)}
              />
            </Form.Group>
            {erro && <MensagemErro>{erro}</MensagemErro>}
            <Botao type="submit" disabled={enviando}>
              {enviando ? 'Aderindo...' : 'Quero receber o boleto todo mês'}
            </Botao>
          </Form>
        )}
    </>
  );
}
