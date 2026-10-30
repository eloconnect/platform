import type { ApiClient, Noticia } from '@eloconnect/shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../api';
import { entrarComo } from '../../test/sessao';
import { PaginaNoticias } from './PaginaNoticias';

vi.mock('../../api', () => ({
  api: {
    listarNoticias: vi.fn<ApiClient['listarNoticias']>(),
    publicarNoticia: vi.fn<ApiClient['publicarNoticia']>(),
    editarNoticia: vi.fn<ApiClient['editarNoticia']>(),
    removerNoticia: vi.fn<ApiClient['removerNoticia']>(),
    enviarImagemNoticia: vi.fn<ApiClient['enviarImagemNoticia']>(),
    removerImagemNoticia: vi.fn<ApiClient['removerImagemNoticia']>(),
    baixarImagemNoticia: vi.fn<ApiClient['baixarImagemNoticia']>(),
  },
}));

// 00h30 de 15/10 em Brasília ainda é 14/10 em Mato Grosso.
const RECENTE: Noticia = {
  id: 'noticia-01',
  titulo: 'Reunião da diretoria',
  conteudo: 'Primeira linha.\nSegunda linha.',
  publicadaEm: '2026-10-15T03:30:00.000Z',
  imagem: null,
};

const ANTIGA: Noticia = {
  id: 'noticia-02',
  titulo: 'Novo horário da sede',
  conteudo: 'Texto fictício.',
  publicadaEm: '2026-10-01T15:00:00.000Z',
  imagem: null,
};

const COM_IMAGEM: Noticia = {
  ...ANTIGA,
  imagem: { descricao: 'Fachada da sede' },
};

const NOVA: Noticia = {
  id: 'noticia-03',
  titulo: 'Convenção assinada',
  conteudo: 'Texto novo.',
  publicadaEm: '2026-10-29T12:00:00.000Z',
  imagem: null,
};

/** A imagem baixada da API vira um endereço local do navegador. */
function simularImagens() {
  vi.mocked(api.baixarImagemNoticia).mockResolvedValue(
    new Blob(['png'], { type: 'image/png' }),
  );
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn<typeof URL.createObjectURL>(() => 'blob:imagem'),
    revokeObjectURL: vi.fn<typeof URL.revokeObjectURL>(),
  });
}

/** Abre a janela de publicação com título e texto preenchidos. */
async function preencherPublicacao() {
  await userEvent.click(
    screen.getByRole('button', { name: 'Publicar notícia' }),
  );
  const janela = screen.getByRole('dialog', { name: 'Publicar notícia' });
  await userEvent.type(within(janela).getByLabelText(/Título/), 'Título');
  await userEvent.type(within(janela).getByLabelText(/Texto/), 'Texto.');
  return janela;
}

async function abrir() {
  render(<PaginaNoticias />);
  await screen.findByRole('button', { name: 'Publicar notícia' });
}

describe('PaginaNoticias', () => {
  beforeEach(() => {
    entrarComo('ADMIN_BASICO');
    vi.mocked(api.listarNoticias).mockResolvedValue([RECENTE, ANTIGA]);
    vi.mocked(api.publicarNoticia).mockReset();
    vi.mocked(api.editarNoticia).mockReset();
    vi.mocked(api.removerNoticia).mockReset();
    vi.mocked(api.enviarImagemNoticia).mockReset();
    vi.mocked(api.removerImagemNoticia).mockReset();
    vi.mocked(api.baixarImagemNoticia).mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('mostra as notícias com a data no horário de Mato Grosso', async () => {
    await abrir();

    const [primeira, segunda] = screen.getAllByRole('article');
    expect(
      within(primeira).getByRole('heading', { name: 'Reunião da diretoria' }),
    ).toBeInTheDocument();
    expect(primeira).toHaveTextContent('Publicada em 14/10/2026');
    expect(within(primeira).getByText(/Primeira linha\./)).toHaveClass(
      'texto-com-quebras',
    );
    expect(segunda).toHaveTextContent('Novo horário da sede');
  });

  it('avisa quando não há notícias', async () => {
    vi.mocked(api.listarNoticias).mockResolvedValue([]);
    await abrir();

    expect(screen.getByText('Nenhuma notícia publicada.')).toBeInTheDocument();
  });

  it('publica com título e texto, e a nova fica em primeiro', async () => {
    vi.mocked(api.publicarNoticia).mockResolvedValue(NOVA);
    await abrir();

    await userEvent.click(
      screen.getByRole('button', { name: 'Publicar notícia' }),
    );
    const janela = screen.getByRole('dialog', { name: 'Publicar notícia' });
    await userEvent.type(
      within(janela).getByLabelText(/Título/),
      '  Convenção assinada ',
    );
    await userEvent.type(within(janela).getByLabelText(/Texto/), 'Texto novo.');
    await userEvent.click(
      within(janela).getByRole('button', { name: 'Publicar' }),
    );

    expect(api.publicarNoticia).toHaveBeenCalledWith({
      titulo: 'Convenção assinada',
      conteudo: 'Texto novo.',
    });
    // Sem imagem, nada de envio de imagem.
    expect(api.enviarImagemNoticia).not.toHaveBeenCalled();
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Notícia publicada.',
    );
    expect(
      within(screen.getAllByRole('article')[0]).getByRole('heading', {
        name: 'Convenção assinada',
      }),
    ).toBeInTheDocument();
  });

  it('não publica sem título e texto', async () => {
    await abrir();

    await userEvent.click(
      screen.getByRole('button', { name: 'Publicar notícia' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Publicar' }));

    expect(
      screen.getByText('Escreva o título da notícia.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Escreva o texto da notícia.')).toBeInTheDocument();
    expect(api.publicarNoticia).not.toHaveBeenCalled();
  });

  it('edita com os dados atuais já preenchidos', async () => {
    vi.mocked(api.editarNoticia).mockResolvedValue({
      ...ANTIGA,
      titulo: 'Horário de fim de ano',
    });
    await abrir();

    await userEvent.click(
      screen.getByRole('button', { name: 'Editar Novo horário da sede' }),
    );
    const janela = screen.getByRole('dialog', { name: 'Editar notícia' });
    const titulo = within(janela).getByLabelText(/Título/);
    expect(titulo).toHaveValue('Novo horário da sede');
    expect(within(janela).getByLabelText(/Texto/)).toHaveValue(
      'Texto fictício.',
    );
    await userEvent.clear(titulo);
    await userEvent.type(titulo, 'Horário de fim de ano');
    await userEvent.click(
      within(janela).getByRole('button', { name: 'Salvar' }),
    );

    expect(api.editarNoticia).toHaveBeenCalledWith('noticia-02', {
      titulo: 'Horário de fim de ano',
      conteudo: 'Texto fictício.',
    });
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Notícia alterada.',
    );
    // A editada continua no mesmo lugar: a data é a da publicação.
    expect(
      within(screen.getAllByRole('article')[1]).getByRole('heading', {
        name: 'Horário de fim de ano',
      }),
    ).toBeInTheDocument();
  });

  it('remove depois da confirmação', async () => {
    vi.mocked(api.removerNoticia).mockResolvedValue(ANTIGA);
    await abrir();

    await userEvent.click(
      screen.getByRole('button', { name: 'Remover Novo horário da sede' }),
    );
    const janela = screen.getByRole('dialog', { name: 'Remover notícia?' });
    expect(janela).toHaveTextContent(
      'Novo horário da sede deixa de aparecer para os associados.',
    );
    await userEvent.click(
      within(janela).getByRole('button', { name: 'Sim, remover' }),
    );

    expect(api.removerNoticia).toHaveBeenCalledWith('noticia-02');
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Notícia removida.',
    );
    expect(
      screen.queryByRole('heading', { name: 'Novo horário da sede' }),
    ).not.toBeInTheDocument();
  });

  it('avisa na janela quando não consegue salvar', async () => {
    vi.mocked(api.publicarNoticia).mockRejectedValue(
      new TypeError('Failed to fetch'),
    );
    await abrir();

    await userEvent.click(
      screen.getByRole('button', { name: 'Publicar notícia' }),
    );
    await userEvent.type(screen.getByLabelText(/Título/), 'Título');
    await userEvent.type(screen.getByLabelText(/Texto/), 'Texto');
    await userEvent.click(screen.getByRole('button', { name: 'Publicar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível salvar agora.',
    );
  });

  it('avisa quando não consegue carregar a lista', async () => {
    vi.mocked(api.listarNoticias).mockRejectedValue(
      new TypeError('Failed to fetch'),
    );
    render(<PaginaNoticias />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar as notícias agora.',
    );
  });

  it('publica com a imagem e a descrição, enviadas depois da notícia', async () => {
    vi.mocked(api.publicarNoticia).mockResolvedValue(NOVA);
    vi.mocked(api.enviarImagemNoticia).mockResolvedValue({
      ...NOVA,
      imagem: { descricao: 'Diretoria reunida' },
    });
    simularImagens();
    await abrir();

    const janela = await preencherPublicacao();
    const foto = new File(['png'], 'foto.png', { type: 'image/png' });
    await userEvent.upload(within(janela).getByLabelText(/^Imagem/), foto);
    await userEvent.type(
      within(janela).getByLabelText(/Descrição da imagem/),
      'Diretoria reunida',
    );
    await userEvent.click(
      within(janela).getByRole('button', { name: 'Publicar' }),
    );

    expect(api.enviarImagemNoticia).toHaveBeenCalledWith('noticia-03', {
      imagem: foto,
      descricao: 'Diretoria reunida',
    });
    expect(
      await within(screen.getAllByRole('article')[0]).findByRole('img', {
        name: 'Diretoria reunida',
      }),
    ).toHaveAttribute('src', 'blob:imagem');
  });

  it('confere a imagem antes de publicar', async () => {
    const usuario = userEvent.setup({ applyAccept: false });
    await abrir();
    const janela = await preencherPublicacao();
    const campo = within(janela).getByLabelText(/^Imagem/);
    const publicar = within(janela).getByRole('button', { name: 'Publicar' });

    await usuario.type(
      within(janela).getByLabelText(/Descrição da imagem/),
      'Foto',
    );
    await usuario.click(publicar);
    expect(
      within(janela).getByText('Escolha a imagem ou apague a descrição.'),
    ).toBeInTheDocument();

    await usuario.upload(
      campo,
      new File(['%PDF-'], 'documento.pdf', { type: 'application/pdf' }),
    );
    await usuario.click(publicar);
    expect(
      within(janela).getByText('Escolha uma imagem JPG, PNG ou WebP.'),
    ).toBeInTheDocument();

    await usuario.upload(
      campo,
      new File([new Uint8Array(4 * 1024 * 1024 + 1)], 'grande.png', {
        type: 'image/png',
      }),
    );
    await usuario.click(publicar);
    expect(
      within(janela).getByText(
        'A imagem pode ter até 4 MB. Escolha uma imagem menor.',
      ),
    ).toBeInTheDocument();
    expect(api.publicarNoticia).not.toHaveBeenCalled();
  });

  it('na edição, mostra a imagem atual e muda só a descrição', async () => {
    vi.mocked(api.listarNoticias).mockResolvedValue([RECENTE, COM_IMAGEM]);
    vi.mocked(api.editarNoticia).mockResolvedValue(COM_IMAGEM);
    vi.mocked(api.enviarImagemNoticia).mockResolvedValue({
      ...COM_IMAGEM,
      imagem: { descricao: 'Fachada nova' },
    });
    simularImagens();
    await abrir();

    await userEvent.click(
      screen.getByRole('button', { name: 'Editar Novo horário da sede' }),
    );
    const janela = screen.getByRole('dialog', { name: 'Editar notícia' });
    expect(
      await within(janela).findByRole('img', { name: 'Fachada da sede' }),
    ).toBeInTheDocument();
    const descricao = within(janela).getByLabelText(/Descrição da imagem/);
    expect(descricao).toHaveValue('Fachada da sede');
    await userEvent.clear(descricao);
    await userEvent.type(descricao, 'Fachada nova');
    await userEvent.click(
      within(janela).getByRole('button', { name: 'Salvar' }),
    );

    expect(api.enviarImagemNoticia).toHaveBeenCalledWith('noticia-02', {
      imagem: undefined,
      descricao: 'Fachada nova',
    });
    expect(
      await screen.findByRole('img', { name: 'Fachada nova' }),
    ).toBeInTheDocument();
  });

  it('na edição, tira a imagem', async () => {
    vi.mocked(api.listarNoticias).mockResolvedValue([RECENTE, COM_IMAGEM]);
    vi.mocked(api.editarNoticia).mockResolvedValue(COM_IMAGEM);
    vi.mocked(api.removerImagemNoticia).mockResolvedValue(ANTIGA);
    simularImagens();
    await abrir();

    await userEvent.click(
      screen.getByRole('button', { name: 'Editar Novo horário da sede' }),
    );
    const janela = screen.getByRole('dialog', { name: 'Editar notícia' });
    await userEvent.click(
      within(janela).getByLabelText('Tirar a imagem desta notícia'),
    );
    expect(within(janela).getByLabelText(/Trocar a imagem/)).toBeDisabled();
    expect(within(janela).getByLabelText(/Descrição da imagem/)).toBeDisabled();
    await userEvent.click(
      within(janela).getByRole('button', { name: 'Salvar' }),
    );

    expect(api.removerImagemNoticia).toHaveBeenCalledWith('noticia-02');
    expect(api.enviarImagemNoticia).not.toHaveBeenCalled();
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Notícia alterada.',
    );
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('avisa quando a notícia sai, mas a imagem não', async () => {
    vi.mocked(api.publicarNoticia).mockResolvedValue(NOVA);
    vi.mocked(api.enviarImagemNoticia).mockRejectedValue(
      new TypeError('Failed to fetch'),
    );
    await abrir();

    const janela = await preencherPublicacao();
    await userEvent.upload(
      within(janela).getByLabelText(/^Imagem/),
      new File(['png'], 'foto.png', { type: 'image/png' }),
    );
    await userEvent.click(
      within(janela).getByRole('button', { name: 'Publicar' }),
    );

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Notícia publicada.',
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível salvar a imagem. Use o botão Editar para tentar de novo.',
    );
  });
});
