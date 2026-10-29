import type { Beneficio, GrupoBeneficio } from '@eloconnect/shared';
import {
  ehGrupoBeneficio,
  GRUPOS_BENEFICIO,
  TEXTO_GRUPO_BENEFICIO,
} from '@eloconnect/shared';
import { useEffect, useState, type FormEvent } from 'react';
import Card from 'react-bootstrap/Card';
import Form from 'react-bootstrap/Form';
import Modal from 'react-bootstrap/Modal';
import { api } from '../../api';
import {
  AvisoSucesso,
  Botao,
  CampoTexto,
  MensagemErro,
  useTituloPagina,
} from '../../componentes';

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'erro' }
  | { tipo: 'ok'; beneficios: Beneficio[] };

/** Janela aberta: cadastro, edição de um benefício ou remoção de um benefício. */
type Janela =
  | { tipo: 'cadastro' }
  | { tipo: 'edicao'; beneficio: Beneficio }
  | { tipo: 'remocao'; beneficio: Beneficio };

/**
 * Cadastro de benefícios pela sede (US24, RF24), em dois grupos (RN32). Os
 * dois perfis da sede usam (RN33). A lista é a mesma da página inicial.
 */
export function PaginaBeneficios() {
  useTituloPagina('Benefícios');
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' });
  const [janela, setJanela] = useState<Janela | null>(null);
  const [aviso, setAviso] = useState<string>();

  useEffect(() => {
    let ativo = true;
    void api
      .listarBeneficios()
      .then((beneficios) => ativo && setEstado({ tipo: 'ok', beneficios }))
      .catch(() => ativo && setEstado({ tipo: 'erro' }));
    return () => {
      ativo = false;
    };
  }, []);

  function concluir(beneficios: Beneficio[], mensagem: string) {
    setEstado({ tipo: 'ok', beneficios });
    setJanela(null);
    setAviso(mensagem);
  }

  const beneficios = estado.tipo === 'ok' ? estado.beneficios : [];

  return (
    <>
      <h1>Benefícios</h1>
      <p>
        Os benefícios aparecem na página inicial do sistema, divididos em dois
        grupos.
      </p>
      {aviso && <AvisoSucesso>{aviso}</AvisoSucesso>}

      {estado.tipo === 'carregando' && (
        <p role="status">Carregando os benefícios...</p>
      )}
      {estado.tipo === 'erro' && (
        <MensagemErro>
          Não foi possível carregar os benefícios agora. Tente de novo em alguns
          minutos.
        </MensagemErro>
      )}

      {estado.tipo === 'ok' && (
        <>
          <Botao
            className="mb-4"
            onClick={() => {
              setAviso(undefined);
              setJanela({ tipo: 'cadastro' });
            }}
          >
            Cadastrar benefício
          </Botao>

          {GRUPOS_BENEFICIO.map((grupo) => {
            const doGrupo = beneficios.filter((b) => b.grupo === grupo);
            return (
              <section
                key={grupo}
                aria-labelledby={`grupo-${grupo}`}
                className="mb-5"
              >
                <h2 id={`grupo-${grupo}`}>{TEXTO_GRUPO_BENEFICIO[grupo]}</h2>
                {doGrupo.length === 0 ? (
                  <p>Nenhum benefício neste grupo.</p>
                ) : (
                  doGrupo.map((beneficio) => (
                    <Card key={beneficio.id} className="mb-3">
                      <Card.Body>
                        <Card.Title as="h3" className="h5">
                          {beneficio.titulo}
                        </Card.Title>
                        <Card.Text className="texto-com-quebras">
                          {beneficio.descricao}
                        </Card.Text>
                        <div className="d-flex flex-wrap gap-3">
                          <Botao
                            variant="outline-primary"
                            aria-label={`Editar ${beneficio.titulo}`}
                            onClick={() => {
                              setAviso(undefined);
                              setJanela({ tipo: 'edicao', beneficio });
                            }}
                          >
                            Editar
                          </Botao>
                          <Botao
                            variant="outline-danger"
                            aria-label={`Remover ${beneficio.titulo}`}
                            onClick={() => {
                              setAviso(undefined);
                              setJanela({ tipo: 'remocao', beneficio });
                            }}
                          >
                            Remover
                          </Botao>
                        </div>
                      </Card.Body>
                    </Card>
                  ))
                )}
              </section>
            );
          })}
        </>
      )}

      <JanelaFormulario
        janela={janela?.tipo === 'remocao' ? null : janela}
        aoFechar={() => setJanela(null)}
        aoConcluir={(salvo, editando) =>
          concluir(
            editando
              ? beneficios.map((b) => (b.id === salvo.id ? salvo : b))
              : [...beneficios, salvo],
            editando ? 'Benefício alterado.' : 'Benefício cadastrado.',
          )
        }
      />
      <JanelaRemocao
        beneficio={janela?.tipo === 'remocao' ? janela.beneficio : null}
        aoFechar={() => setJanela(null)}
        aoConcluir={(removido) =>
          concluir(
            beneficios.filter((b) => b.id !== removido.id),
            'Benefício removido.',
          )
        }
      />
    </>
  );
}

/** Cadastro ou edição: nome, descrição e grupo. */
function JanelaFormulario({
  janela,
  aoFechar,
  aoConcluir,
}: {
  janela:
    { tipo: 'cadastro' } | { tipo: 'edicao'; beneficio: Beneficio } | null;
  aoFechar: () => void;
  aoConcluir: (salvo: Beneficio, editando: boolean) => void;
}) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(false);
  const [erros, setErros] = useState<{ titulo?: string; descricao?: string }>(
    {},
  );
  const editando = janela?.tipo === 'edicao' ? janela.beneficio : null;

  function fechar() {
    setErro(false);
    setErros({});
    aoFechar();
  }

  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const dados = new FormData(evento.currentTarget);
    const titulo = textoDo(dados, 'titulo');
    const descricao = textoDo(dados, 'descricao');
    const escolhido = dados.get('grupo');
    const grupo =
      typeof escolhido === 'string' && ehGrupoBeneficio(escolhido)
        ? escolhido
        : undefined;
    const novosErros = {
      titulo: titulo ? undefined : 'Escreva o nome do benefício.',
      descricao: descricao ? undefined : 'Escreva a descrição do benefício.',
    };
    setErros(novosErros);
    if (novosErros.titulo || novosErros.descricao || !grupo) return;

    setEnviando(true);
    setErro(false);
    try {
      const salvo = editando
        ? await api.editarBeneficio(editando.id, { titulo, descricao, grupo })
        : await api.criarBeneficio({ titulo, descricao, grupo });
      setErros({});
      aoConcluir(salvo, editando !== null);
    } catch {
      setErro(true);
    } finally {
      setEnviando(false);
    }
  }

  const grupoInicial: GrupoBeneficio = editando?.grupo ?? 'CONSULTORIA';

  return (
    <Modal
      show={janela !== null}
      onHide={fechar}
      centered
      aria-labelledby="titulo-janela-beneficio"
    >
      <Form noValidate onSubmit={(e) => void salvar(e)}>
        <Modal.Header closeButton closeLabel="Fechar">
          <Modal.Title as="h2" className="h4" id="titulo-janela-beneficio">
            {editando ? 'Editar benefício' : 'Cadastrar benefício'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {erro && (
            <MensagemErro>
              Não foi possível salvar agora. Tente de novo em alguns minutos.
            </MensagemErro>
          )}
          <CampoTexto
            rotulo="Nome do benefício"
            name="titulo"
            maxLength={120}
            obrigatorio
            defaultValue={editando?.titulo ?? ''}
            erro={erros.titulo}
          />
          <CampoTexto
            rotulo="Descrição"
            name="descricao"
            linhas={4}
            maxLength={2000}
            obrigatorio
            defaultValue={editando?.descricao ?? ''}
            erro={erros.descricao}
          />
          <fieldset>
            <legend className="fs-6 fw-semibold">Grupo</legend>
            {GRUPOS_BENEFICIO.map((grupo) => (
              <Form.Check
                key={grupo}
                type="radio"
                id={`grupo-${grupo}-opcao`}
                name="grupo"
                value={grupo}
                label={TEXTO_GRUPO_BENEFICIO[grupo]}
                defaultChecked={grupo === grupoInicial}
              />
            ))}
          </fieldset>
        </Modal.Body>
        <Modal.Footer>
          <Botao variant="outline-secondary" onClick={fechar}>
            Cancelar
          </Botao>
          <Botao type="submit" disabled={enviando}>
            Salvar
          </Botao>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

/** Texto de um campo do formulário, sem os espaços das pontas. */
function textoDo(dados: FormData, campo: string): string {
  const valor = dados.get(campo);
  return typeof valor === 'string' ? valor.trim() : '';
}

/** Confirmação antes de remover. */
function JanelaRemocao({
  beneficio,
  aoFechar,
  aoConcluir,
}: {
  beneficio: Beneficio | null;
  aoFechar: () => void;
  aoConcluir: (removido: Beneficio) => void;
}) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(false);

  function fechar() {
    setErro(false);
    aoFechar();
  }

  async function remover(alvo: Beneficio) {
    setEnviando(true);
    setErro(false);
    try {
      aoConcluir(await api.removerBeneficio(alvo.id));
    } catch {
      setErro(true);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      show={beneficio !== null}
      onHide={fechar}
      centered
      aria-labelledby="titulo-janela-remocao"
    >
      <Modal.Header closeButton closeLabel="Fechar">
        <Modal.Title as="h2" className="h4" id="titulo-janela-remocao">
          Remover benefício?
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {erro && (
          <MensagemErro>
            Não foi possível remover agora. Tente de novo em alguns minutos.
          </MensagemErro>
        )}
        <p className="mb-0">
          {beneficio?.titulo} deixa de aparecer na página inicial e no sistema.
        </p>
      </Modal.Body>
      <Modal.Footer>
        <Botao variant="outline-secondary" onClick={fechar}>
          Cancelar
        </Botao>
        <Botao
          variant="danger"
          disabled={enviando}
          onClick={() => beneficio && void remover(beneficio)}
        >
          Sim, remover
        </Botao>
      </Modal.Footer>
    </Modal>
  );
}
