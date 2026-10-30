import type {
  Convencao,
  CriarConvencaoRequest,
  EditarConvencaoRequest,
} from '@eloconnect/shared';
import { ApiError } from '@eloconnect/shared';
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

/** A Vercel aceita no máximo 4,5 MB por requisição (P24). */
const TAMANHO_MAXIMO_PDF = 4 * 1024 * 1024;

const MENSAGEM_TAMANHO =
  'Cada PDF pode ter até 4 MB. Diminua o arquivo e tente novamente.';

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'erro' }
  | { tipo: 'ok'; convencoes: Convencao[] };

type Janela =
  | { tipo: 'cadastro' }
  | { tipo: 'edicao'; convencao: Convencao }
  | { tipo: 'anexos'; convencao: Convencao };

export function PaginaConvencoes() {
  useTituloPagina('Convenções coletivas');

  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' });
  const [janela, setJanela] = useState<Janela | null>(null);
  const [aviso, setAviso] = useState<string>();
  const [erroPublicacao, setErroPublicacao] = useState(false);

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

  async function publicar(convencao: Convencao) {
    setAviso(undefined);
    setErroPublicacao(false);

    try {
      const publicada = await api.publicarConvencao(convencao.id);

      setEstado((atual) =>
        atual.tipo === 'ok'
          ? {
              tipo: 'ok',
              convencoes: atual.convencoes.map((item) =>
                item.id === publicada.id ? publicada : item,
              ),
            }
          : atual,
      );
      setAviso('Convenção publicada.');
    } catch {
      setErroPublicacao(true);
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

      {erroPublicacao && (
        <MensagemErro>
          Não foi possível publicar a convenção. Tente novamente.
        </MensagemErro>
      )}

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

                  {!convencao.publicadaEm && !temOsDoisPdfs(convencao) && (
                    <p>
                      Para publicar, envie os dois PDFs: o integral e o
                      resumido.
                    </p>
                  )}

                  <div className="d-flex flex-wrap gap-3">
                    <Botao
                      variant="outline-primary"
                      onClick={() => {
                        setJanela({ tipo: 'edicao', convencao });
                      }}
                    >
                      Editar
                    </Botao>

                    <Botao
                      variant="outline-primary"
                      onClick={() => {
                        setJanela({ tipo: 'anexos', convencao });
                      }}
                    >
                      Enviar PDFs
                    </Botao>

                    {!convencao.publicadaEm && (
                      <Botao
                        disabled={!temOsDoisPdfs(convencao)}
                        onClick={() => void publicar(convencao)}
                      >
                        Publicar
                      </Botao>
                    )}
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
        aoFechar={() => setJanela(null)}
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
        aoFechar={() => setJanela(null)}
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
    </>
  );
}

function JanelaConvencao({
  janela,
  aoFechar,
  aoSalvar,
}: {
  janela:
    { tipo: 'cadastro' } | { tipo: 'edicao'; convencao: Convencao } | null;
  aoFechar: () => void;
  aoSalvar: (salva: Convencao, editando: boolean) => void;
}) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(false);
  const [erros, setErros] = useState<{
    titulo?: string;
    ano?: string;
    resumo?: string;
  }>({});
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
      resumo: resumo ? undefined : 'Informe o resumo.',
    };

    setErros(novosErros);

    if (novosErros.titulo || novosErros.ano || novosErros.resumo) return;

    const dadosConvencao: CriarConvencaoRequest = { titulo, ano, resumo };

    setEnviando(true);
    setErro(false);

    try {
      const salva = editando
        ? await api.editarConvencao(
            editando.id,
            dadosConvencao as EditarConvencaoRequest,
          )
        : await api.criarConvencao(dadosConvencao);

      aoSalvar(salva, editando !== null);
    } catch {
      setErro(true);
    } finally {
      setEnviando(false);
    }
  }

  function fechar() {
    setErro(false);
    setErros({});
    aoFechar();
  }

  return (
    <Modal
      show={janela !== null}
      onHide={fechar}
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
            erro={erros.resumo}
          />
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

function JanelaAnexos({
  convencao,
  aoFechar,
  aoSalvar,
}: {
  convencao: Convencao | null;
  aoFechar: () => void;
  aoSalvar: (salva: Convencao) => void;
}) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string>();

  function fechar() {
    setErro(undefined);
    aoFechar();
  }

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
    const escolhidos = [integral, resumida].filter(
      (arquivo): arquivo is File => arquivo !== undefined && arquivo.size > 0,
    );

    if (escolhidos.length === 0) {
      setErro('Escolha pelo menos um PDF.');
      return;
    }

    // Na primeira vez, a API exige os dois PDFs.
    if (convencao && convencao.anexos.length === 0 && escolhidos.length < 2) {
      setErro('Na primeira vez, envie os dois PDFs: o integral e o resumido.');
      return;
    }

    if (escolhidos.some((arquivo) => arquivo.size > TAMANHO_MAXIMO_PDF)) {
      setErro(MENSAGEM_TAMANHO);
      return;
    }

    setEnviando(true);
    setErro(undefined);

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
    } catch (e) {
      setErro(
        e instanceof ApiError && e.status === 413
          ? MENSAGEM_TAMANHO
          : e instanceof ApiError && e.status === 400
            ? 'Os arquivos precisam ser PDFs. Confira e tente novamente.'
            : 'Não foi possível enviar os documentos. Tente novamente.',
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      show={convencao !== null}
      onHide={fechar}
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

          {erro && <MensagemErro>{erro}</MensagemErro>}

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
          <Botao variant="outline-secondary" onClick={fechar}>
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

/** A publicação exige os dois PDFs (RN12). */
function temOsDoisPdfs(convencao: Convencao): boolean {
  return (['INTEGRAL', 'RESUMIDA'] as const).every((tipo) =>
    convencao.anexos.some((anexo) => anexo.tipo === tipo),
  );
}

function textoDo(dados: FormData, campo: string): string {
  const valor = dados.get(campo);
  return typeof valor === 'string' ? valor.trim() : '';
}
