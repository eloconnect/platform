import type { ApiClient, Noticia } from '@eloconnect/shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../api';
import { entrarComo } from '../../test/sessao';
import { PaginaNoticias } from './PaginaNoticias';

vi.mock('../../api', () => ({
  api: {
    listarNoticias: vi.fn<ApiClient['listarNoticias']>(),
    publicarNoticia: vi.fn<ApiClient['publicarNoticia']>(),
    editarNoticia: vi.fn<ApiClient['editarNoticia']>(),
    removerNoticia: vi.fn<ApiClient['removerNoticia']>(),
  },
}));

// 00h30 de 15/10 em Brasília ainda é 14/10 em Mato Grosso.
const RECENTE: Noticia = {
  id: 'noticia-01',
  titulo: 'Reunião da diretoria',
  conteudo: 'Primeira linha.\nSegunda linha.',
  publicadaEm: '2026-10-15T03:30:00.000Z',
};

const ANTIGA: Noticia = {
  id: 'noticia-02',
  titulo: 'Novo horário da sede',
  conteudo: 'Texto fictício.',
  publicadaEm: '2026-10-01T15:00:00.000Z',
};

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
    const nova: Noticia = {
      id: 'noticia-03',
      titulo: 'Convenção assinada',
      conteudo: 'Texto novo.',
      publicadaEm: '2026-10-29T12:00:00.000Z',
    };
    vi.mocked(api.publicarNoticia).mockResolvedValue(nova);
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
});
