import type { ApiClient, Noticia } from '@eloconnect/shared';
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../api';
import { PaginaNoticiasAssociado } from './PaginaNoticiasAssociado';

vi.mock('../../api', () => ({
  api: { listarNoticias: vi.fn<ApiClient['listarNoticias']>() },
}));

const NOTICIAS: Noticia[] = [
  {
    id: 'noticia-01',
    titulo: 'Reunião da diretoria',
    conteudo: 'Primeira linha.\nSegunda linha.',
    // 00h30 de 15/10 em Brasília ainda é 14/10 em Mato Grosso.
    publicadaEm: '2026-10-15T03:30:00.000Z',
  },
  {
    id: 'noticia-02',
    titulo: 'Novo horário da sede',
    conteudo: 'Texto fictício.',
    publicadaEm: '2026-10-01T15:00:00.000Z',
  },
];

describe('PaginaNoticiasAssociado', () => {
  beforeEach(() => {
    vi.mocked(api.listarNoticias).mockResolvedValue(NOTICIAS);
  });

  it('mostra as notícias na ordem da API, com a data e as quebras de linha', async () => {
    render(<PaginaNoticiasAssociado />);

    const artigos = await screen.findAllByRole('article');
    expect(artigos).toHaveLength(2);
    expect(
      within(artigos[0]).getByRole('heading', {
        level: 2,
        name: 'Reunião da diretoria',
      }),
    ).toBeInTheDocument();
    expect(artigos[0]).toHaveTextContent('Publicada em 14/10/2026');
    expect(within(artigos[0]).getByText(/Primeira linha\./)).toHaveClass(
      'texto-com-quebras',
    );
    expect(artigos[1]).toHaveTextContent('Novo horário da sede');
    // Só leitura: o associado não edita nem remove.
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('avisa quando ainda não há notícias', async () => {
    vi.mocked(api.listarNoticias).mockResolvedValue([]);
    render(<PaginaNoticiasAssociado />);

    expect(
      await screen.findByText('Ainda não há notícias.'),
    ).toBeInTheDocument();
  });

  it('avisa quando não consegue carregar', async () => {
    vi.mocked(api.listarNoticias).mockRejectedValue(
      new TypeError('Failed to fetch'),
    );
    render(<PaginaNoticiasAssociado />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar as notícias agora.',
    );
  });
});
