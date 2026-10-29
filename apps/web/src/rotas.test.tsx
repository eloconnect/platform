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
    listarLogAuditoria: vi.fn<ApiClient['listarLogAuditoria']>(),
    listarUsuariosSede: vi.fn<ApiClient['listarUsuariosSede']>(),
    minhaConta: vi.fn<ApiClient['minhaConta']>(),
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
  it('abre a página de criar conta', () => {
    abrir('/cadastro');

    expect(
      screen.getByRole('heading', { name: /criar conta/i }),
    ).toBeInTheDocument();
  });

  it('abre a página de criar a senha da conta nova', () => {
    abrir('/criar-senha?token=token-de-teste');

    expect(
      screen.getByRole('heading', { name: /crie sua senha/i }),
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
    vi.mocked(api.minhaConta).mockResolvedValue({
      nome: 'Farmácia Teste',
      situacao: 'Adimplente',
      acessoLiberadoAte: null,
    });
    vi.mocked(api.listarAssociados).mockResolvedValue({
      itens: [],
      total: 0,
      pagina: 1,
      porPagina: 20,
    });
    vi.mocked(api.listarLogAuditoria).mockResolvedValue({
      itens: [],
      total: 0,
      pagina: 1,
      porPagina: 20,
    });
    vi.mocked(api.listarUsuariosSede).mockResolvedValue([]);
  });

  it.each([
    ['/admin', 'ADMIN', 'Painel da sede'],
    ['/admin/associados', 'ADMIN', 'Associados'],
    ['/admin/associados/novo', 'ADMIN', 'Cadastrar associado'],
    ['/admin/auditoria', 'ADMIN', 'Histórico de ações'],
    ['/admin', 'ADMIN_BASICO', 'Painel da sede'],
    ['/admin/associados', 'ADMIN_BASICO', 'Associados'],
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
    ['/associado', 'ADMIN_BASICO', 'Painel da sede'],
    // O cadastro é só do chave mestre (RN33).
    ['/admin/associados/novo', 'ADMIN_BASICO', 'Painel da sede'],
    // O histórico de ações também (RN33).
    ['/admin/auditoria', 'ADMIN_BASICO', 'Painel da sede'],
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

  it('só o chave mestre vê o histórico de ações no menu (RN33)', () => {
    entrarComo('ADMIN');
    abrir('/admin');
    expect(
      screen.getByRole('link', { name: 'Histórico de ações' }),
    ).toHaveAttribute('href', '/admin/auditoria');
  });

  it('o perfil básico não vê o histórico de ações no menu (RN33)', () => {
    entrarComo('ADMIN_BASICO');
    abrir('/admin');
    expect(
      screen.queryByRole('link', { name: 'Histórico de ações' }),
    ).not.toBeInTheDocument();
  });

  it('"Sair" encerra a sessão', async () => {
    entrarComo('ADMIN');
    abrir('/admin');
    await userEvent.click(screen.getByRole('link', { name: 'Sair' }));
    expect(lerSessao()).toBeNull();
  });
});
