import type {
  Beneficio,
  BeneficiosAssociado,
  GrupoBeneficio,
} from '@eloconnect/shared';
import { ApiError, LIMITES_SUPORTE } from '@eloconnect/shared';
import { useEffect, useState, type FormEvent } from 'react';
import Form from 'react-bootstrap/Form';
import { Link } from 'react-router';
import { api } from '../../api';
import {
  AvisoSucesso,
  Botao,
  CampoTexto,
  Carregando,
  MensagemErro,
  useTituloPagina,
} from '../../componentes';

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'erro' }
  | { tipo: 'ok'; dados: BeneficiosAssociado };

const GRUPOS: {
  grupo: GrupoBeneficio;
  titulo: string;
  liberado: (dados: BeneficiosAssociado) => boolean;
  bloqueado: string;
}[] = [
  {
    grupo: 'CONSULTORIA',
    titulo: 'Consultoria',
    liberado: (dados) => dados.consultoriaLiberada,
    bloqueado:
      'Disponível para quem está com a contribuição em dia, a partir do primeiro boleto pago.',
  },
  {
    grupo: 'ASSESSORIA_JURIDICA',
    titulo: 'Assessoria jurídica',
    liberado: (dados) => dados.juridicaLiberada,
    bloqueado:
      'Disponível com o plano anual pago, porque a assessoria jurídica exige o ano inteiro pago antes.',
  },
];

/**
 * Benefícios e suporte (US25: RF25, RN32). O associado vê os benefícios de
 * cada grupo e se já pode usá-los. Quem está em dia pede suporte por aqui, e
 * a sede responde por e-mail.
 */
export function PaginaBeneficiosAssociado() {
  useTituloPagina('Benefícios e suporte');
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' });

  useEffect(() => {
    let ativo = true;
    void api
      .meusBeneficios()
      .then((dados) => ativo && setEstado({ tipo: 'ok', dados }))
      .catch(() => ativo && setEstado({ tipo: 'erro' }));
    return () => {
      ativo = false;
    };
  }, []);

  const dados = estado.tipo === 'ok' ? estado.dados : null;
  return (
    <>
      <h1>Benefícios e suporte</h1>
      {estado.tipo === 'carregando' && <Carregando texto="Carregando..." />}
      {estado.tipo === 'erro' && (
        <MensagemErro>
          Não foi possível carregar os benefícios agora. Tente de novo em alguns
          minutos.
        </MensagemErro>
      )}
      {dados &&
        GRUPOS.map(({ grupo, titulo, liberado, bloqueado }) => (
          <GrupoDeBeneficios
            key={grupo}
            titulo={titulo}
            beneficios={dados.beneficios.filter((b) => b.grupo === grupo)}
            liberado={liberado(dados)}
            textoBloqueado={bloqueado}
          />
        ))}
      {dados && (
        <section aria-labelledby="titulo-suporte" className="mt-4">
          <h2 id="titulo-suporte">Pedir suporte</h2>
          {dados.consultoriaLiberada ? (
            <FormularioSuporte />
          ) : (
            <>
              <p>O suporte é para quem está com a contribuição em dia.</p>
              <Link className="btn btn-primary btn-lg" to="/associado">
                Ver como ficar em dia
              </Link>
            </>
          )}
        </section>
      )}
    </>
  );
}

function GrupoDeBeneficios({
  titulo,
  beneficios,
  liberado,
  textoBloqueado,
}: {
  titulo: string;
  beneficios: Beneficio[];
  liberado: boolean;
  textoBloqueado: string;
}) {
  return (
    <section className="elo-boleto" aria-label={titulo}>
      <h2>{titulo}</h2>
      <p className={liberado ? 'text-success fw-bold' : ''}>
        {liberado ? 'Liberado para a sua farmácia.' : textoBloqueado}
      </p>
      {beneficios.length === 0 ? (
        <p className="mb-0">A sede ainda não cadastrou benefícios aqui.</p>
      ) : (
        <ul className="mb-0">
          {beneficios.map((beneficio) => (
            <li key={beneficio.id} className="mb-2">
              <strong>{beneficio.titulo}</strong>
              <div className="texto-com-quebras">{beneficio.descricao}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FormularioSuporte() {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [erros, setErros] = useState<{ assunto?: string; mensagem?: string }>(
    {},
  );
  const [enviado, setEnviado] = useState(false);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    const dados = new FormData(formulario);
    const assunto = textoDo(dados, 'assunto');
    const mensagem = textoDo(dados, 'mensagem');
    const novos = {
      assunto: assunto ? undefined : 'Informe o assunto.',
      mensagem: mensagem ? undefined : 'Escreva a mensagem.',
    };
    setErros(novos);
    if (novos.assunto || novos.mensagem) return;
    setErro(null);
    setEnviando(true);
    try {
      await api.enviarSuporte({ assunto, mensagem });
      formulario.reset();
      setEnviado(true);
    } catch (e) {
      setErro(
        e instanceof ApiError && e.status === 403
          ? 'O suporte é para quem está com a contribuição em dia.'
          : 'Não foi possível enviar agora. Tente de novo em alguns minutos.',
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Form noValidate onSubmit={(evento) => void enviar(evento)}>
      {enviado && (
        <AvisoSucesso>
          Pedido enviado. A sede vai responder no e-mail da farmácia.
        </AvisoSucesso>
      )}
      <p>A sede responde no e-mail da farmácia.</p>
      <CampoTexto
        rotulo="Assunto"
        name="assunto"
        maxLength={LIMITES_SUPORTE.assunto}
        obrigatorio
        erro={erros.assunto}
      />
      <CampoTexto
        rotulo="Mensagem"
        name="mensagem"
        linhas={5}
        maxLength={LIMITES_SUPORTE.mensagem}
        obrigatorio
        erro={erros.mensagem}
      />
      {erro && <MensagemErro>{erro}</MensagemErro>}
      <Botao type="submit" disabled={enviando}>
        {enviando ? 'Enviando...' : 'Enviar o pedido'}
      </Botao>
    </Form>
  );
}

function textoDo(dados: FormData, campo: string): string {
  const valor = dados.get(campo);
  return typeof valor === 'string' ? valor.trim() : '';
}
