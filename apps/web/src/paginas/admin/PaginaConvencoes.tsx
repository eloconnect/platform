import type {
  Convencao,
  CriarConvencaoRequest,
  EditarConvencaoRequest,
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
  | { tipo: 'ok'; convencoes: Convencao[] };

type Janela =
  | { tipo: 'cadastro' }
  | { tipo: 'edicao'; convencao: Convencao }
  | { tipo: 'anexos'; convencao: Convencao }
  | { tipo: 'remocao'; convencao: Convencao };

export function PaginaConvencoes() {
  useTituloPagina('Convenções coletivas');

  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' });
  const [janela, setJanela] = useState<Janela | null>(null);
  const [aviso, setAviso] = useState<string>();
  const [erroAcao, setErroAcao] = useState(false);

  async function carregar() {
    try {
      const convencoes = await api.listarConvencoes();
      setEstado({ tipo: 'ok', convencoes });
    } catch {
      setEstado({ tipo: 'erro' });
    }
  }

  useEffect(() => {
    let ativo = true;

    void api
      .listarConvencoes()
      .then((convencoes) => {
        if (ativo) setEstado({ tipo: 'ok', convencoes });
      })
      .catch(() => {
        if (ativo) setEstado({ tipo: 'erro' });
      });

    return () => {
      ativo = false;
    };
  }, []);

  const convencoes = estado.tipo === 'ok' ? estado.convencoes : [];

  async function executarAcao(
    acao: () => Promise<Convencao>,
    mensagem: string,
  ) {
    setErroAcao(false);

    try {
      const salva = await acao();

      setEstado((atual) => {
        if (atual.tipo !== 'ok') {
          return { tipo: 'ok', convencoes: [salva] };
        }

        const existe = atual.convencoes.some((item) => item.id === salva.id);

        return {
          tipo: 'ok',
          convencoes: existe
            ? atual.convencoes.map((item) =>
                item.id === salva.id ? salva : item,
              )
            : [...atual.convencoes, salva],
        };
      });

      setJanela(null);
      setAviso(mensagem);
    } catch {
      setErroAcao(true);
    }
  }

  async function publicar(convencao: Convencao) {
    await executarAcao(
      () => api.publicarConvencao(convencao.id),
      'Convenção publicada.',
    );
  }

  async function remover(convencao: Convencao) {
    setErroAcao(false);

    try {
      await api.removerConvencao(convencao.id);
      setEstado((atual) => ({
        tipo: 'ok',
        convencoes:
          atual.tipo === 'ok'
            ? atual.convencoes.filter((item) => item.id !== convencao.id)
            : [],
      }));
      setJanela(null);
      setAviso('Convenção removida.');
    } catch {
      setErroAcao(true);
    }
  }

  return (
    <>
      <h1>Convenções coletivas</h1>
      <p>
        Cadastre as convenções, envie os documentos em PDF e publique-os para
        consulta pelos associados.
      </p>

      {aviso && <AvisoSucesso>{aviso}</AvisoSucesso>}

      {estado.tipo === 'carregando' && (
        <p role="status">Carregando as convenções...</p>
      )}

      {estado.tipo === 'erro' && (
        <>
          <MensagemErro>
            Não foi possível carregar as convenções. Tente novamente.
          </MensagemErro>
          <Botao onClick={() => void carregar()}>Tentar novamente</Botao>
        </>
      )}

      {estado.tipo === 'ok' && (
        <>
          <Botao
            className="mb-4"
            onClick={() => {
              setAviso(undefined);
              setErroAcao(false);
              setJanela({ tipo: 'cadastro' });
            }}
          >
            Cadastrar convenção
          </Botao>

          {convencoes.length === 0 ? (
            <p>Nenhuma convenção cadastrada.</p>
          ) : (
            convencoes.map((convencao) => (
              <Card key={convencao.id} className="mb-3">
                <Card.Body>
                  <Card.Title as="h2" className="h5">
                    {convencao.titulo}
                  </Card.Title>

                  <p className="mb-2">Ano: {convencao.ano}</p>

                  <p className="texto-com-quebras">{convencao.resumo}</p>

                  <p>
                    Situação:{' '}
                    <strong>
                      {convencao.publicadaEm ? 'Publicada' : 'Rascunho'}
                    </strong>
                  </p>

                  <p>
                    Documentos:{' '}
                    {convencao.anexos
                      .map((anexo) =>
                        anexo.tipo === 'INTEGRAL' ? 'Integral' : 'Resumido',
                      )
                      .join(', ') || 'Nenhum enviado'}
                  </p>

                  <div className="d-flex flex-wrap gap-3">
                    <Botao
                      variant="outline-primary"
                      onClick={() => {
                        setErroAcao(false);
                        setJanela({ tipo: 'edicao', convencao });
                      }}
                    >
                      Editar
                    </Botao>

                    <Botao
                      variant="outline-primary"
                      onClick={() => {
                        setErroAcao(false);
                        setJanela({ tipo: 'anexos', convencao });
                      }}
                    >
                      Enviar PDFs
                    </Botao>

                    {!convencao.publicadaEm && (
                      <Botao onClick={() => void publicar(convencao)}>
                        Publicar
                      </Botao>
                    )}

                    <Botao
                      variant="outline-danger"
                      onClick={() => {
                        setErroAcao(false);
                        setJanela({ tipo: 'remocao', convencao });
                      }}
                    >
                      Remover
                    </Botao>
                  </div>
                </Card.Body>
              </Card>
            ))
          )}
        </>
      )}

      <JanelaConvencao
        janela={
          janela?.tipo === 'cadastro' || janela?.tipo === 'edicao'
            ? janela
            : null
        }
        erro={erroAcao}
        aoFechar={() => {
          setJanela(null);
          setErroAcao(false);
        }}
        aoSalvar={(salva, editando) => {
          setEstado((atual) => {
            if (atual.tipo !== 'ok') {
              return { tipo: 'ok', convencoes: [salva] };
            }

            return {
              tipo: 'ok',
              convencoes: editando
                ? atual.convencoes.map((item) =>
                    item.id === salva.id ? salva : item,
                  )
                : [...atual.convencoes, salva],
            };
          });
          setJanela(null);
          setAviso(editando ? 'Convenção alterada.' : 'Convenção cadastrada.');
        }}
      />

      <JanelaAnexos
        convencao={janela?.tipo === 'anexos' ? janela.convencao : null}
        erro={erroAcao}
        aoFechar={() => {
          setJanela(null);
          setErroAcao(false);
        }}
        aoSalvar={(salva) => {
          setEstado((atual) => ({
            tipo: 'ok',
            convencoes:
              atual.tipo === 'ok'
                ? atual.convencoes.map((item) =>
                    item.id === salva.id ? salva : item,
                  )
                : [salva],
          }));
          setJanela(null);
          setAviso('Documentos enviados.');
        }}
      />

      <Modal
        show={janela?.tipo === 'remocao'}
        onHide={() => setJanela(null)}
        centered
        aria-labelledby="titulo-remover-convencao"
      >
        <Modal.Header closeButton closeLabel="Fechar">
          <Modal.Title as="h2" className="h4" id="titulo-remover-convencao">
            Remover convenção?
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {erroAcao && (
            <MensagemErro>
              Não foi possível remover a convenção. Tente novamente.
            </MensagemErro>
          )}
          <p>
            Deseja remover a convenção{' '}
            <strong>
              {janela?.tipo === 'remocao' ? janela.convencao.titulo : ''}
            </strong>
            ?
          </p>
        </Modal.Body>

        <Modal.Footer>
          <Botao variant="outline-secondary" onClick={() => setJanela(null)}>
            Cancelar
          </Botao>
          <Botao
            variant="danger"
            onClick={() => {
              if (janela?.tipo === 'remocao') {
                void remover(janela.convencao);
              }
            }}
          >
            Sim, remover
          </Botao>
        </Modal.Footer>
      </Modal>
    </>
  );
}

function JanelaConvencao({
  janela,
  erro,
  aoFechar,
  aoSalvar,
}: {
  janela:
    { tipo: 'cadastro' } | { tipo: 'edicao'; convencao: Convencao } | null;
  erro: boolean;
  aoFechar: () => void;
  aoSalvar: (salva: Convencao, editando: boolean) => void;
}) {
  const [enviando, setEnviando] = useState(false);
  const [erros, setErros] = useState<{ titulo?: string; ano?: string }>({});
  const [anoAtual] = useState(() => new Date().getFullYear());

  const editando = janela?.tipo === 'edicao' ? janela.convencao : null;

  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    const dados = new FormData(evento.currentTarget);
    const titulo = textoDo(dados, 'titulo');
    const resumo = textoDo(dados, 'resumo');
    const anoTexto = textoDo(dados, 'ano');
    const ano = Number(anoTexto);

    const novosErros = {
      titulo: titulo ? undefined : 'Informe o título.',
      ano:
        ano >= 1900 && ano <= 2100 && Number.isInteger(ano)
          ? undefined
          : 'Informe um ano válido.',
    };

    setErros(novosErros);

    if (novosErros.titulo || novosErros.ano || !resumo) return;

    const dadosConvencao: CriarConvencaoRequest = { titulo, ano, resumo };

    setEnviando(true);

    try {
      const salva = editando
        ? await api.editarConvencao(
            editando.id,
            dadosConvencao as EditarConvencaoRequest,
          )
        : await api.criarConvencao(dadosConvencao);

      aoSalvar(salva, editando !== null);
    } catch {
      setErros((atual) => ({ ...atual }));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      show={janela !== null}
      onHide={aoFechar}
      centered
      aria-labelledby="titulo-form-convencao"
    >
      <Form noValidate onSubmit={(evento) => void salvar(evento)}>
        <Modal.Header closeButton closeLabel="Fechar">
          <Modal.Title as="h2" className="h4" id="titulo-form-convencao">
            {editando ? 'Editar convenção' : 'Cadastrar convenção'}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {erro && (
            <MensagemErro>
              Não foi possível concluir a operação. Confira os dados e tente
              novamente.
            </MensagemErro>
          )}

          <CampoTexto
            rotulo="Título da convenção"
            name="titulo"
            maxLength={160}
            obrigatorio
            defaultValue={editando?.titulo ?? ''}
            erro={erros.titulo}
          />

          <Form.Group className="mb-3">
            <Form.Label htmlFor="ano-convencao">Ano</Form.Label>
            <Form.Control
              id="ano-convencao"
              name="ano"
              type="number"
              min={1900}
              max={2100}
              step={1}
              required
              defaultValue={String(editando?.ano ?? anoAtual)}
              isInvalid={Boolean(erros.ano)}
            />
            {erros.ano && (
              <Form.Control.Feedback type="invalid">
                {erros.ano}
              </Form.Control.Feedback>
            )}
          </Form.Group>

          <CampoTexto
            rotulo="Resumo"
            name="resumo"
            linhas={4}
            maxLength={2000}
            obrigatorio
            defaultValue={editando?.resumo ?? ''}
          />
        </Modal.Body>

        <Modal.Footer>
          <Botao variant="outline-secondary" onClick={aoFechar}>
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

function JanelaAnexos({
  convencao,
  erro,
  aoFechar,
  aoSalvar,
}: {
  convencao: Convencao | null;
  erro: boolean;
  aoFechar: () => void;
  aoSalvar: (salva: Convencao) => void;
}) {
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    const formulario = evento.currentTarget;

    const campoIntegral = formulario.querySelector<HTMLInputElement>(
      'input[name="integral"]',
    );

    const campoResumida = formulario.querySelector<HTMLInputElement>(
      'input[name="resumida"]',
    );

    const integral = campoIntegral?.files?.[0];
    const resumida = campoResumida?.files?.[0];

    if (
      (!integral || integral.size === 0) &&
      (!resumida || resumida.size === 0)
    ) {
      return;
    }

    setEnviando(true);

    try {
      const arquivos = new FormData();

      if (integral && integral.size > 0) {
        arquivos.append('integral', integral);
      }

      if (resumida && resumida.size > 0) {
        arquivos.append('resumida', resumida);
      }

      const salva = await api.atualizarAnexosConvencao(convencao!.id, arquivos);

      aoSalvar(salva);
    } catch {
      // O estado de erro é tratado pelo componente pai.
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      show={convencao !== null}
      onHide={aoFechar}
      centered
      aria-labelledby="titulo-anexos-convencao"
    >
      <Form onSubmit={(evento) => void enviar(evento)}>
        <Modal.Header closeButton closeLabel="Fechar">
          <Modal.Title as="h2" className="h4" id="titulo-anexos-convencao">
            Enviar PDFs
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <p>
            Convenção: <strong>{convencao?.titulo}</strong>
          </p>

          {erro && (
            <MensagemErro>
              Não foi possível enviar os documentos. Verifique se são PDFs
              válidos de até 4 MB e tente novamente.
            </MensagemErro>
          )}

          <Form.Group className="mb-3">
            <Form.Label htmlFor="pdf-integral">
              Convenção integral (PDF)
            </Form.Label>
            <Form.Control
              id="pdf-integral"
              name="integral"
              type="file"
              accept="application/pdf,.pdf"
            />
            <Form.Text>Limite de 4 MB.</Form.Text>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label htmlFor="pdf-resumido">
              Convenção resumida (PDF)
            </Form.Label>
            <Form.Control
              id="pdf-resumido"
              name="resumida"
              type="file"
              accept="application/pdf,.pdf"
            />
            <Form.Text>Limite de 4 MB.</Form.Text>
          </Form.Group>
        </Modal.Body>

        <Modal.Footer>
          <Botao variant="outline-secondary" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao type="submit" disabled={enviando}>
            Enviar documentos
          </Botao>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

function textoDo(dados: FormData, campo: string): string {
  const valor = dados.get(campo);
  return typeof valor === 'string' ? valor.trim() : '';
}
