import type { Noticia } from '@eloconnect/shared';
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
  | { tipo: 'ok'; noticias: Noticia[] };

/** Janela aberta: publicação, edição de uma notícia ou remoção de uma notícia. */
type Janela =
  | { tipo: 'publicacao' }
  | { tipo: 'edicao'; noticia: Noticia }
  | { tipo: 'remocao'; noticia: Noticia };

/**
 * Notícias do feed (RF41). Os dois perfis da sede usam (RN33). A lista é a
 * mesma que os associados veem, da mais recente para a mais antiga.
 */
export function PaginaNoticias() {
  useTituloPagina('Notícias');
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' });
  const [janela, setJanela] = useState<Janela | null>(null);
  const [aviso, setAviso] = useState<string>();

  useEffect(() => {
    let ativo = true;
    void api
      .listarNoticias()
      .then((noticias) => ativo && setEstado({ tipo: 'ok', noticias }))
      .catch(() => ativo && setEstado({ tipo: 'erro' }));
    return () => {
      ativo = false;
    };
  }, []);

  function concluir(noticias: Noticia[], mensagem: string) {
    setEstado({ tipo: 'ok', noticias });
    setJanela(null);
    setAviso(mensagem);
  }

  const noticias = estado.tipo === 'ok' ? estado.noticias : [];

  return (
    <>
      <h1>Notícias</h1>
      <p>
        As notícias aparecem para todos os associados que entram no sistema, da
        mais recente para a mais antiga.
      </p>
      {aviso && <AvisoSucesso>{aviso}</AvisoSucesso>}

      {estado.tipo === 'carregando' && (
        <p role="status">Carregando as notícias...</p>
      )}
      {estado.tipo === 'erro' && (
        <MensagemErro>
          Não foi possível carregar as notícias agora. Tente de novo em alguns
          minutos.
        </MensagemErro>
      )}

      {estado.tipo === 'ok' && (
        <>
          <Botao
            className="mb-4"
            onClick={() => {
              setAviso(undefined);
              setJanela({ tipo: 'publicacao' });
            }}
          >
            Publicar notícia
          </Botao>

          {noticias.length === 0 && <p>Nenhuma notícia publicada.</p>}
          {noticias.map((noticia) => (
            <Card key={noticia.id} as="article" className="mb-3">
              <Card.Body>
                <Card.Title as="h2" className="h5">
                  {noticia.titulo}
                </Card.Title>
                <Card.Text className="text-body-secondary">
                  Publicada em {formatarData(noticia.publicadaEm)}
                </Card.Text>
                <Card.Text className="texto-com-quebras">
                  {noticia.conteudo}
                </Card.Text>
                <div className="d-flex flex-wrap gap-3">
                  <Botao
                    variant="outline-primary"
                    aria-label={`Editar ${noticia.titulo}`}
                    onClick={() => {
                      setAviso(undefined);
                      setJanela({ tipo: 'edicao', noticia });
                    }}
                  >
                    Editar
                  </Botao>
                  <Botao
                    variant="outline-danger"
                    aria-label={`Remover ${noticia.titulo}`}
                    onClick={() => {
                      setAviso(undefined);
                      setJanela({ tipo: 'remocao', noticia });
                    }}
                  >
                    Remover
                  </Botao>
                </div>
              </Card.Body>
            </Card>
          ))}
        </>
      )}

      <JanelaFormulario
        janela={janela?.tipo === 'remocao' ? null : janela}
        aoFechar={() => setJanela(null)}
        aoConcluir={(salva, editando) =>
          concluir(
            editando
              ? noticias.map((n) => (n.id === salva.id ? salva : n))
              : [salva, ...noticias],
            editando ? 'Notícia alterada.' : 'Notícia publicada.',
          )
        }
      />
      <JanelaRemocao
        noticia={janela?.tipo === 'remocao' ? janela.noticia : null}
        aoFechar={() => setJanela(null)}
        aoConcluir={(removida) =>
          concluir(
            noticias.filter((n) => n.id !== removida.id),
            'Notícia removida.',
          )
        }
      />
    </>
  );
}

/** Publicação ou edição: título e texto. */
function JanelaFormulario({
  janela,
  aoFechar,
  aoConcluir,
}: {
  janela: { tipo: 'publicacao' } | { tipo: 'edicao'; noticia: Noticia } | null;
  aoFechar: () => void;
  aoConcluir: (salva: Noticia, editando: boolean) => void;
}) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(false);
  const [erros, setErros] = useState<{ titulo?: string; conteudo?: string }>(
    {},
  );
  const editando = janela?.tipo === 'edicao' ? janela.noticia : null;

  function fechar() {
    setErro(false);
    setErros({});
    aoFechar();
  }

  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const dados = new FormData(evento.currentTarget);
    const titulo = textoDo(dados, 'titulo');
    const conteudo = textoDo(dados, 'conteudo');
    const novosErros = {
      titulo: titulo ? undefined : 'Escreva o título da notícia.',
      conteudo: conteudo ? undefined : 'Escreva o texto da notícia.',
    };
    setErros(novosErros);
    if (novosErros.titulo || novosErros.conteudo) return;

    setEnviando(true);
    setErro(false);
    try {
      const salva = editando
        ? await api.editarNoticia(editando.id, { titulo, conteudo })
        : await api.publicarNoticia({ titulo, conteudo });
      setErros({});
      aoConcluir(salva, editando !== null);
    } catch {
      setErro(true);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      show={janela !== null}
      onHide={fechar}
      centered
      size="lg"
      aria-labelledby="titulo-janela-noticia"
    >
      <Form noValidate onSubmit={(e) => void salvar(e)}>
        <Modal.Header closeButton closeLabel="Fechar">
          <Modal.Title as="h2" className="h4" id="titulo-janela-noticia">
            {editando ? 'Editar notícia' : 'Publicar notícia'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {erro && (
            <MensagemErro>
              Não foi possível salvar agora. Tente de novo em alguns minutos.
            </MensagemErro>
          )}
          <CampoTexto
            rotulo="Título"
            name="titulo"
            maxLength={150}
            obrigatorio
            defaultValue={editando?.titulo ?? ''}
            erro={erros.titulo}
          />
          <CampoTexto
            rotulo="Texto"
            name="conteudo"
            linhas={8}
            maxLength={10000}
            obrigatorio
            defaultValue={editando?.conteudo ?? ''}
            erro={erros.conteudo}
          />
        </Modal.Body>
        <Modal.Footer>
          <Botao variant="outline-secondary" onClick={fechar}>
            Cancelar
          </Botao>
          <Botao type="submit" disabled={enviando}>
            {editando ? 'Salvar' : 'Publicar'}
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

/** Data no horário de Mato Grosso, onde fica a sede. */
function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    timeZone: 'America/Cuiaba',
  });
}

/** Confirmação antes de remover. */
function JanelaRemocao({
  noticia,
  aoFechar,
  aoConcluir,
}: {
  noticia: Noticia | null;
  aoFechar: () => void;
  aoConcluir: (removida: Noticia) => void;
}) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(false);

  function fechar() {
    setErro(false);
    aoFechar();
  }

  async function remover(alvo: Noticia) {
    setEnviando(true);
    setErro(false);
    try {
      aoConcluir(await api.removerNoticia(alvo.id));
    } catch {
      setErro(true);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      show={noticia !== null}
      onHide={fechar}
      centered
      aria-labelledby="titulo-janela-remocao"
    >
      <Modal.Header closeButton closeLabel="Fechar">
        <Modal.Title as="h2" className="h4" id="titulo-janela-remocao">
          Remover notícia?
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {erro && (
          <MensagemErro>
            Não foi possível remover agora. Tente de novo em alguns minutos.
          </MensagemErro>
        )}
        <p className="mb-0">
          {noticia?.titulo} deixa de aparecer para os associados.
        </p>
      </Modal.Body>
      <Modal.Footer>
        <Botao variant="outline-secondary" onClick={fechar}>
          Cancelar
        </Botao>
        <Botao
          variant="danger"
          disabled={enviando}
          onClick={() => noticia && void remover(noticia)}
        >
          Sim, remover
        </Botao>
      </Modal.Footer>
    </Modal>
  );
}
