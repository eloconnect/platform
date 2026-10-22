import type { ApiClient } from '@eloconnect/shared';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';
import { rotas } from './rotas';

vi.mock('./api', () => ({
  api: {
    getHealth: vi.fn<ApiClient['getHealth']>(),
    getPaginaInicial: vi.fn<ApiClient['getPaginaInicial']>(),
  },
}));

function abrir(caminho: string) {
  render(
    <RouterProvider
      router={createMemoryRouter(rotas, { initialEntries: [caminho] })}
    />,
  );
}

describe('Rotas', () => {
  beforeEach(() => {
    vi.mocked(api.getHealth).mockReset();
    vi.mocked(api.getPaginaInicial).mockReset();

    vi.mocked(api.getPaginaInicial).mockResolvedValue({
      configuracao: {
        titulo: 'Informações do sindicato',
        descricao: 'Acesse os serviços disponíveis no portal.',
        imagemUrl: null,
        imagemAlt: null,
      },
      beneficios: [],
      convencoes: [],
      noticias: [],
    });
  });

  it('abre a página inicial com o link para pular ao conteúdo', () => {
    abrir('/');

    expect(
      screen.getByRole('link', { name: 'Elo Connect' }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('link', { name: 'Pular para o conteúdo' }),
    ).toHaveAttribute('href', '#conteudo');
    expect(
      screen.getByRole('link', { name: 'Pular para o conteúdo' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { name: 'Menu principal' }),
    ).toBeInTheDocument();
  });

  it.each([
    ['/entrar', 'Entrar'],
    ['/esqueci-senha', 'Esqueci minha senha'],
    ['/associado', 'Área do associado'],
    ['/admin', 'Painel da sede'],
    ['/nao-existe', 'Página não encontrada'],
  ])('%s mostra "%s"', (caminho, titulo) => {
    abrir(caminho);
    expect(
      screen.getByRole('heading', { level: 1, name: titulo }),
    ).toBeInTheDocument();
  });

  it('/status mostra que a API e o banco respondem', async () => {
    vi.mocked(api.getHealth).mockResolvedValue({
      status: 'ok',
      database: 'ok',
      timestamp: new Date().toISOString(),
    });
    abrir('/status');
    expect(await screen.findByText('Tudo funcionando')).toBeInTheDocument();
  });

  it('/status avisa quando a API não responde', async () => {
    vi.mocked(api.getHealth).mockRejectedValue(new Error('sem conexão'));
    abrir('/status');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A API não respondeu',
    );
  });
});
