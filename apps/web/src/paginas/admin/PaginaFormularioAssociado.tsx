import type {
  AssociadoDetalhe,
  CriarAssociadoRequest,
} from '@eloconnect/shared';
import { ApiError, cnpjValido, formatarCnpj } from '@eloconnect/shared';
import { useEffect, useState } from 'react';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../../api';
import {
  Botao,
  CampoTexto,
  MensagemErro,
  useTituloPagina,
} from '../../componentes';

type Campos = Required<{
  [Campo in keyof CriarAssociadoRequest]: NonNullable<
    CriarAssociadoRequest[Campo]
  >;
}>;

const VAZIO: Campos = {
  cnpj: '',
  razaoSocial: '',
  nomeFantasia: '',
  email: '',
  telefone: '',
  municipio: '',
  contribuicaoAtiva: false,
};

type Resultado =
  | { tipo: 'ok'; associado: AssociadoDetalhe }
  | { tipo: 'nao-encontrado' }
  | { tipo: 'erro' };

/**
 * Cadastro e edição de associado pela sede (US08, RF08). Sem id no endereço,
 * cadastra; com id, carrega os dados e edita.
 */
export function PaginaFormularioAssociado() {
  const { id } = useParams();
  const titulo = id ? 'Editar dados do associado' : 'Cadastrar associado';
  useTituloPagina(titulo);

  return (
    <>
      <h1>{titulo}</h1>
      {id ? <CarregarEEditar id={id} /> : <Formulario inicial={VAZIO} />}
    </>
  );
}

function CarregarEEditar({ id }: { id: string }) {
  // Guarda de qual associado é o resultado: se o endereço mudou, está carregando.
  const [resultado, setResultado] = useState<
    (Resultado & { id: string }) | null
  >(null);

  useEffect(() => {
    let ativo = true;
    void api
      .buscarAssociado(id)
      .then((associado) => ativo && setResultado({ id, tipo: 'ok', associado }))
      .catch(
        (e: unknown) =>
          ativo &&
          setResultado({
            id,
            tipo:
              e instanceof ApiError && (e.status === 404 || e.status === 400)
                ? 'nao-encontrado'
                : 'erro',
          }),
      );
    return () => {
      ativo = false;
    };
  }, [id]);

  if (resultado?.id !== id) return <p role="status">Carregando...</p>;
  if (resultado.tipo === 'nao-encontrado') {
    return (
      <>
        <MensagemErro>Associado não encontrado.</MensagemErro>
        <Link to="/admin/associados">Voltar para a lista de associados</Link>
      </>
    );
  }
  if (resultado.tipo === 'erro') {
    return (
      <MensagemErro>
        Não foi possível carregar o associado agora. Tente de novo em alguns
        minutos.
      </MensagemErro>
    );
  }
  const { associado } = resultado;
  return (
    <Formulario
      id={id}
      temConta={associado.conta !== null}
      inicial={{
        cnpj: formatarCnpj(associado.cnpj),
        razaoSocial: associado.razaoSocial,
        nomeFantasia: associado.nomeFantasia ?? '',
        email: associado.email ?? '',
        telefone: associado.telefone ?? '',
        municipio: associado.municipio ?? '',
        contribuicaoAtiva: associado.contribuicaoAtiva,
      }}
    />
  );
}

function Formulario({
  id,
  inicial,
  temConta = false,
}: {
  id?: string;
  inicial: Campos;
  /** O associado já tem conta de acesso: o e-mail também é o login (RN34). */
  temConta?: boolean;
}) {
  const navegar = useNavigate();
  const [campos, setCampos] = useState(inicial);
  const [erroCnpj, setErroCnpj] = useState<string>();
  const [erroEmail, setErroEmail] = useState<string>();
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const voltarPara = id ? `/admin/associados/${id}` : '/admin/associados';

  const texto = (campo: Exclude<keyof Campos, 'contribuicaoAtiva'>) => ({
    name: campo,
    value: campos[campo],
    onChange: (evento: { target: { value: string } }) =>
      setCampos((atuais) => ({ ...atuais, [campo]: evento.target.value })),
  });

  // Leva o foco ao CNPJ, para o leitor de tela ler o erro junto com o campo.
  function mostrarErroCnpj(mensagem: string) {
    setErroCnpj(mensagem);
    document.getElementById('campo-cnpj')?.focus();
  }

  function mostrarErroEmail(mensagem: string) {
    setErroEmail(mensagem);
    document.getElementById('campo-email')?.focus();
  }

  async function salvar() {
    setErro(null);
    if (!cnpjValido(campos.cnpj)) {
      mostrarErroCnpj('CNPJ inválido. Confira os números digitados.');
      return;
    }
    setErroCnpj(undefined);
    setErroEmail(undefined);
    setEnviando(true);
    try {
      const associado = id
        ? await api.editarAssociado(id, campos)
        : await api.criarAssociado(campos);
      await navegar(`/admin/associados/${associado.id}`, {
        state: { aviso: id ? 'Dados salvos.' : 'Associado cadastrado.' },
      });
    } catch (e) {
      // A mensagem depende só do status e do campo, nunca do texto do erro.
      if (e instanceof ApiError && e.campo === 'email' && e.status === 409) {
        mostrarErroEmail('Este e-mail já é usado na conta de outra farmácia.');
      } else if (e instanceof ApiError && e.campo === 'email') {
        mostrarErroEmail(
          'O associado já tem conta de acesso, então o e-mail não pode ficar vazio.',
        );
      } else if (e instanceof ApiError && e.status === 409) {
        mostrarErroCnpj('Já existe um associado com este CNPJ.');
      } else {
        setErro(
          e instanceof ApiError && e.status === 400
            ? 'Confira os dados digitados e tente de novo.'
            : 'Não foi possível salvar agora. Tente de novo em alguns minutos.',
        );
      }
      setEnviando(false);
    }
  }

  return (
    <Row>
      <Col lg={8}>
        <Form
          onSubmit={(evento) => {
            evento.preventDefault();
            void salvar();
          }}
        >
          {erro && <MensagemErro>{erro}</MensagemErro>}

          <CampoTexto
            id="campo-cnpj"
            rotulo="CNPJ"
            ajuda="Com ou sem pontuação."
            obrigatorio
            autoComplete="off"
            erro={erroCnpj}
            {...texto('cnpj')}
          />
          <CampoTexto
            rotulo="Razão social"
            obrigatorio
            autoComplete="off"
            {...texto('razaoSocial')}
          />
          <CampoTexto
            rotulo="Nome fantasia"
            autoComplete="off"
            {...texto('nomeFantasia')}
          />
          <CampoTexto
            id="campo-email"
            rotulo="E-mail"
            type="email"
            autoComplete="off"
            obrigatorio={temConta}
            ajuda={
              temConta
                ? 'É também o e-mail de acesso do associado. Ao trocar, ele passa a entrar com o novo e-mail e recebe um aviso nos dois endereços.'
                : undefined
            }
            erro={erroEmail}
            {...texto('email')}
          />
          <CampoTexto
            rotulo="Telefone"
            type="tel"
            autoComplete="off"
            {...texto('telefone')}
          />
          <CampoTexto
            rotulo="Município"
            autoComplete="off"
            {...texto('municipio')}
          />

          {id && inicial.contribuicaoAtiva ? (
            // Interromper tem ação própria, com motivo, aviso e os 30 dias
            // de acesso (RN25).
            <p className="mb-4">
              Recebe boleto mensal: Sim. Para interromper, use &quot;Interromper
              a cobrança mensal&quot; no perfil do associado.
            </p>
          ) : (
            <Form.Group as="fieldset" className="mb-4">
              <Form.Label as="legend" className="fs-6">
                Recebe boleto mensal
              </Form.Label>
              {[true, false].map((valor) => (
                <Form.Check
                  key={String(valor)}
                  type="radio"
                  id={`recebe-boleto-${valor ? 'sim' : 'nao'}`}
                  name="contribuicaoAtiva"
                  label={valor ? 'Sim' : 'Não'}
                  checked={campos.contribuicaoAtiva === valor}
                  onChange={() =>
                    setCampos((atuais) => ({
                      ...atuais,
                      contribuicaoAtiva: valor,
                    }))
                  }
                />
              ))}
            </Form.Group>
          )}

          <div className="d-flex flex-wrap align-items-center gap-3">
            <Botao type="submit" disabled={enviando}>
              {enviando ? 'Salvando...' : 'Salvar'}
            </Botao>
            <Link to={voltarPara}>Cancelar</Link>
          </div>
        </Form>
      </Col>
    </Row>
  );
}
