import type { ApiClient } from '@eloconnect/shared';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';
import { rotas } from './rotas';

vi.mock('./api', () => ({
  api: { getHealth: vi.fn<ApiClient['getHealth']>() },
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
  });

  it('abre a landing page com os serviços e as ações de acesso', () => {
    abrir('/');
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Informação e apoio para fortalecer o setor farmacêutico',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Pular para o conteúdo' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { name: 'Menu principal' }),
    ).toBeInTheDocument();
    expect(
      screen
        .getAllByRole('link', { name: 'Entrar' })
        .every((link) => link.getAttribute('href') === '/entrar'),
    ).toBe(true);
    expect(screen.getByRole('link', { name: 'Criar conta' })).toHaveAttribute(
      'href',
      '/#cadastro',
    );
    expect(
      screen.getByRole('heading', { name: 'Convenções coletivas' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Conteúdo provisório')).toBeInTheDocument();
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
