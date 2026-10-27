import type { ApiClient, Perfil } from '@eloconnect/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';
import { rotas } from './rotas';
import { lerSessao, salvarSessao } from './sessao';

vi.mock('./api', () => ({
  api: {
    getHealth: vi.fn<ApiClient['getHealth']>(),
    listarAssociados: vi.fn<ApiClient['listarAssociados']>(),
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
  });
  it('abre a página de cadastro em construção', () => {
    abrir('/cadastro');

    expect(
      screen.getByRole('heading', {
        name: /cadastro em construção/i,
      }),
    ).toBeInTheDocument();
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

function entrarComo(perfil: Perfil) {
  salvarSessao({
    accessToken: 'token',
    usuario: { id: 'id', email: 'teste@example.com', nome: 'Teste', perfil },
  });
}

describe('Áreas logadas', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.mocked(api.listarAssociados).mockResolvedValue({
      itens: [],
      total: 0,
      pagina: 1,
      porPagina: 20,
    });
  });

  it.each([
    ['/admin', 'ADMIN', 'Painel da sede'],
    ['/admin/associados', 'ADMIN', 'Associados'],
    ['/associado', 'ASSOCIADO', 'Área do associado'],
  ] as const)('%s abre para o perfil %s', (caminho, perfil, titulo) => {
    entrarComo(perfil);
    abrir(caminho);
    expect(
      screen.getByRole('heading', { level: 1, name: titulo }),
    ).toBeInTheDocument();
  });

  it.each(['/admin', '/associado'])(
    '%s sem login vai para o login',
    (caminho) => {
      abrir(caminho);
      expect(
        screen.getByRole('heading', { level: 1, name: 'Entrar' }),
      ).toBeInTheDocument();
    },
  );

  it.each([
    ['/admin', 'ASSOCIADO', 'Área do associado'],
    ['/associado', 'ADMIN', 'Painel da sede'],
  ] as const)(
    '%s com o perfil %s vai para a própria área',
    (caminho, perfil, titulo) => {
      entrarComo(perfil);
      abrir(caminho);
      expect(
        screen.getByRole('heading', { level: 1, name: titulo }),
      ).toBeInTheDocument();
    },
  );

  it('"Sair" encerra a sessão', async () => {
    entrarComo('ADMIN');
    abrir('/admin');
    await userEvent.click(screen.getByRole('link', { name: 'Sair' }));
    expect(lerSessao()).toBeNull();
  });
});
