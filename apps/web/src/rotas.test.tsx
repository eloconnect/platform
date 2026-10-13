import type { ApiClient } from '@eloconnect/shared';
import { ApiError } from '@eloconnect/shared';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';
import { rotas } from './rotas';

vi.mock('./api', () => ({
  api: {
    getHealth: vi.fn<ApiClient['getHealth']>(),
    login: vi.fn<ApiClient['login']>(),
    solicitarRecuperacaoSenha: vi.fn<ApiClient['solicitarRecuperacaoSenha']>(),
    redefinirSenha: vi.fn<ApiClient['redefinirSenha']>(),
    admin: {
      resumo: vi.fn<ApiClient['admin']['resumo']>(),
      associados: vi.fn<ApiClient['admin']['associados']>(),
      ficha: vi.fn<ApiClient['admin']['ficha']>(),
      valores: vi.fn<ApiClient['admin']['valores']>(),
      cancelamentos: vi.fn<ApiClient['admin']['cancelamentos']>(),
      propor: vi.fn<ApiClient['admin']['propor']>(),
      aprovarCancelamento: vi.fn<ApiClient['admin']['aprovarCancelamento']>(),
      definirAcesso: vi.fn<ApiClient['admin']['definirAcesso']>(),
      convencoes: vi.fn<ApiClient['admin']['convencoes']>(),
    },
    associado: {
      painel: vi.fn<ApiClient['associado']['painel']>(),
      historico: vi.fn<ApiClient['associado']['historico']>(),
      convencoes: vi.fn<ApiClient['associado']['convencoes']>(),
      noticias: vi.fn<ApiClient['associado']['noticias']>(),
      beneficios: vi.fn<ApiClient['associado']['beneficios']>(),
      definirRecorrencia: vi.fn<ApiClient['associado']['definirRecorrencia']>(),
      solicitarCancelamento:
        vi.fn<ApiClient['associado']['solicitarCancelamento']>(),
    },
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
    vi.mocked(api.login).mockReset();
    vi.mocked(api.solicitarRecuperacaoSenha).mockReset();
    vi.mocked(api.redefinirSenha).mockReset();
    vi.mocked(api.admin.resumo).mockReset().mockResolvedValue({
      totalAssociados: 0,
      emDia: 0,
      taxaAdimplencia: 0,
      arrecadacaoMensal: 0,
      valorMensal: 0,
    });
    vi.mocked(api.admin.associados).mockReset().mockResolvedValue({
      total: 0,
      pagina: 1,
      porPagina: 5,
      totalPaginas: 1,
      itens: [],
    });
    localStorage.clear();
    sessionStorage.clear();
  });

  it('abre a landing page no visual do portal e apresenta os serviços', () => {
    abrir('/');
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'A força que impulsiona e protege o setor farmacêutico.',
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
    expect(
      screen.getByRole('link', { name: 'Filie sua Farmácia Agora' }),
    ).toHaveAttribute('href', '/cadastro');
    expect(
      screen
        .getAllByRole('link', { name: 'Cadastrar farmácia' })
        .every((link) => link.getAttribute('href') === '/cadastro'),
    ).toBe(true);
    expect(
      screen.getByRole('link', { name: 'Convenções coletivas' }),
    ).toHaveAttribute('href', '/#convencoes');
    expect(screen.getByRole('link', { name: 'Contribuições' })).toHaveAttribute(
      'href',
      '/entrar',
    );
    expect(
      screen.getByRole('heading', {
        name: 'Convenções Coletivas e Pisos Vigentes',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: 'Fortaleça o seu negócio. Seja parte do sindicato que luta pela sua farmácia.',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', {
        name: 'Equipe de profissionais em atendimento em uma farmácia.',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Filie sua Farmácia Agora' }),
    ).toHaveAttribute('href', '/cadastro');
  });

  it('links de convenção e filiação levam às páginas de acesso correspondentes', () => {
    abrir('/');
    fireEvent.click(
      screen.getByRole('link', {
        name: 'Entrar para consultar: CCT Geral — Varejo Farmacêutico Estadual',
      }),
    );
    expect(
      screen.getByRole('heading', { level: 1, name: 'Acesse sua área' }),
    ).toBeInTheDocument();
  });

  it('botão de filiação abre o cadastro da farmácia', () => {
    abrir('/');
    fireEvent.click(
      screen.getByRole('link', { name: 'Enviar solicitação de filiação' }),
    );
    expect(
      screen.getByRole('heading', { level: 1, name: 'Cadastrar farmácia' }),
    ).toBeInTheDocument();
  });

  it('atalho do plantão inicia uma ligação para a central', () => {
    abrir('/');
    expect(
      screen.getByRole('link', {
        name: 'Ligar para o Plantão Trabalhista no 0800 724 4500',
      }),
    ).toHaveAttribute('href', 'tel:08007244500');
  });

  it.each([
    ['/entrar', 'Acesse sua área'],
    ['/esqueci-senha', 'Esqueci minha senha'],
    ['/cadastro', 'Cadastrar farmácia'],
    ['/cadastro/confirmar', 'Confirme os dados da farmácia'],
    ['/admin', 'Painel Executivo de Arrecadação Patronal'],
    ['/nao-existe', 'Página não encontrada'],
  ])('%s mostra "%s"', (caminho, titulo) => {
    abrir(caminho);
    expect(
      screen.getByRole('heading', { level: 1, name: titulo }),
    ).toBeInTheDocument();
  });

  it('/entrar apresenta acesso por senha sem solicitar código a cada login', () => {
    abrir('/entrar');
    expect(
      screen.getByRole('textbox', { name: /e-mail cadastrado/i }),
    ).toBeInTheDocument();
    const senha = screen.getByLabelText(/senha de acesso/i, {
      selector: 'input',
    });
    expect(senha).toHaveAttribute('type', 'password');
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar' }));
    expect(senha).toHaveAttribute('type', 'text');
    expect(
      screen.getByRole('link', { name: 'Cadastrar farmácia' }),
    ).toHaveAttribute('href', '/cadastro');
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled();
  });

  it('/entrar autentica, guarda a sessão e abre a área do perfil', async () => {
    vi.mocked(api.login).mockResolvedValue({
      accessToken: 'jwt',
      usuario: {
        id: '1',
        email: 'admin@example.com',
        nome: 'Admin',
        perfil: 'ADMIN',
      },
    });
    abrir('/entrar');
    fireEvent.change(
      screen.getByRole('textbox', { name: /e-mail cadastrado/i }),
      {
        target: { value: ' admin@example.com ' },
      },
    );
    fireEvent.change(
      screen.getByLabelText(/senha de acesso/i, { selector: 'input' }),
      { target: { value: 'segredo123' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Painel Executivo de Arrecadação Patronal',
      }),
    ).toBeInTheDocument();
    expect(api.login).toHaveBeenCalledWith({
      email: 'admin@example.com',
      senha: 'segredo123',
    });
    expect(sessionStorage.getItem('eloconnect.sessao')).toContain('jwt');
    expect(localStorage.getItem('eloconnect.sessao')).toBeNull();
  });

  it('/entrar mostra erro quando as credenciais são recusadas', async () => {
    vi.mocked(api.login).mockRejectedValue(new ApiError(401, 'não autorizado'));
    abrir('/entrar');
    fireEvent.change(
      screen.getByRole('textbox', { name: /e-mail cadastrado/i }),
      {
        target: { value: 'a@example.com' },
      },
    );
    fireEvent.change(
      screen.getByLabelText(/senha de acesso/i, { selector: 'input' }),
      { target: { value: 'errada' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'E-mail ou senha inválidos',
    );
    expect(sessionStorage.getItem('eloconnect.sessao')).toBeNull();
  });

  it('/esqueci-senha envia o pedido e mostra a confirmação', async () => {
    vi.mocked(api.solicitarRecuperacaoSenha).mockResolvedValue({
      mensagem: 'Se o e-mail estiver cadastrado, enviaremos um link.',
    });
    abrir('/esqueci-senha');
    fireEvent.change(
      screen.getByRole('textbox', { name: /e-mail cadastrado/i }),
      {
        target: { value: 'a@example.com' },
      },
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Enviar link de recuperação' }),
    );

    expect(await screen.findByRole('status')).toHaveTextContent(
      'enviaremos um link',
    );
    expect(api.solicitarRecuperacaoSenha).toHaveBeenCalledWith({
      email: 'a@example.com',
    });
  });

  it('/redefinir-senha sem token pede um novo link', () => {
    abrir('/redefinir-senha');
    expect(screen.getByRole('alert')).toHaveTextContent('Link inválido');
  });

  it('/redefinir-senha não envia quando as senhas diferem', async () => {
    abrir('/redefinir-senha?token=abc');
    fireEvent.change(screen.getByLabelText(/^nova senha/i), {
      target: { value: 'senha-nova-1' },
    });
    fireEvent.change(screen.getByLabelText(/repita a nova senha/i), {
      target: { value: 'senha-nova-2' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'As senhas não são iguais',
    );
    expect(api.redefinirSenha).not.toHaveBeenCalled();
  });

  it('/redefinir-senha troca a senha com o token do link', async () => {
    vi.mocked(api.redefinirSenha).mockResolvedValue({ mensagem: 'ok' });
    abrir('/redefinir-senha?token=abc');
    fireEvent.change(screen.getByLabelText(/^nova senha/i), {
      target: { value: 'senha-nova-1' },
    });
    fireEvent.change(screen.getByLabelText(/repita a nova senha/i), {
      target: { value: 'senha-nova-1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }));

    await waitFor(() =>
      expect(api.redefinirSenha).toHaveBeenCalledWith({
        token: 'abc',
        senha: 'senha-nova-1',
      }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Senha redefinida',
    );
  });

  it('/redefinir-senha avisa quando o link expirou', async () => {
    vi.mocked(api.redefinirSenha).mockRejectedValue(new ApiError(400, 'ruim'));
    abrir('/redefinir-senha?token=abc');
    fireEvent.change(screen.getByLabelText(/^nova senha/i), {
      target: { value: 'senha-nova-1' },
    });
    fireEvent.change(screen.getByLabelText(/repita a nova senha/i), {
      target: { value: 'senha-nova-1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Link inválido ou expirado',
    );
  });

  it('/cadastro/confirmar mostra os campos de validação solicitados', () => {
    abrir('/cadastro/confirmar');
    expect(
      screen.getByRole('textbox', { name: /cinco dígitos do cnpj/i }),
    ).toHaveAttribute('maxLength', '5');
    expect(
      screen.getByRole('textbox', { name: /e-mail da farmácia/i }),
    ).toHaveAttribute('type', 'email');
    expect(
      screen.getByRole('button', { name: 'Confirmar dados e continuar' }),
    ).toBeDisabled();
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

  it('/admin lista as farmácias vindas da API com o token da sessão', async () => {
    sessionStorage.setItem(
      'eloconnect.sessao',
      JSON.stringify({
        accessToken: 'jwt',
        usuario: { id: '1', email: 'a@x.com', nome: 'Admin', perfil: 'ADMIN' },
      }),
    );
    vi.mocked(api.admin.resumo).mockResolvedValue({
      totalAssociados: 80,
      emDia: 40,
      taxaAdimplencia: 50,
      arrecadacaoMensal: 9600,
      valorMensal: 120,
    });
    vi.mocked(api.admin.associados).mockResolvedValue({
      total: 80,
      pagina: 1,
      porPagina: 5,
      totalPaginas: 16,
      itens: [
        {
          id: 'a1',
          nome: 'Drogaria Teste',
          razaoSocial: 'Drogaria Teste Ltda',
          cnpj: '41000000000100',
          cidade: 'Cuiabá / MT',
          situacao: 'INADIMPLENTE',
          bloqueado: false,
        },
      ],
    });
    abrir('/admin');
    expect(await screen.findByText('Drogaria Teste')).toBeInTheDocument();
    expect(screen.getByText('Inadimplente')).toBeInTheDocument();
    expect(api.admin.associados).toHaveBeenCalledWith('jwt', '', 1);
    expect(
      screen.getByRole('link', { name: 'Ver perfil de Drogaria Teste' }),
    ).toHaveAttribute('href', '/admin/afiliados/a1');
  });

  it('/associado mostra a mensalidade em aberto da farmácia', async () => {
    sessionStorage.setItem(
      'eloconnect.sessao',
      JSON.stringify({
        accessToken: 'jwt',
        usuario: {
          id: '2',
          email: 'f@x.com',
          nome: 'Paulo',
          perfil: 'ASSOCIADO',
        },
      }),
    );
    vi.mocked(api.associado.painel).mockResolvedValue({
      nomeUsuario: 'Paulo',
      farmacia: {
        razaoSocial: 'Drogaria Santa Luzia Ltda',
        nomeFantasia: 'Drogaria Santa Luzia',
        cnpj: '14288902000144',
        situacao: 'EM_DIA',
      },
      valorMensal: 185,
      valorAnual: 1776,
      recorrente: false,
      cancelamentoPendente: false,
      boleto: {
        id: 'b1',
        competencia: '2025-11-01',
        vencimento: '2099-11-15',
        valor: 185,
        status: 'EM_ABERTO',
        linhaDigitavel: '123',
        pixCopiaECola: 'pix',
      },
    });
    abrir('/associado');
    expect(
      await screen.findByText('Mensalidade de Novembro/2025'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Mensalidade e Boletos da Farmácia',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', {
        name: 'Ver histórico de pagamentos anteriores',
      }),
    ).toHaveAttribute('href', '/associado/historico');
  });

  it('/associado/filiacao só habilita o cancelamento após a ciência', async () => {
    sessionStorage.setItem(
      'eloconnect.sessao',
      JSON.stringify({
        accessToken: 'jwt',
        usuario: {
          id: '2',
          email: 'f@x.com',
          nome: 'Paulo',
          perfil: 'ASSOCIADO',
        },
      }),
    );
    vi.mocked(api.associado.painel).mockResolvedValue({
      nomeUsuario: 'Paulo',
      farmacia: {
        razaoSocial: 'Drogaria Santa Luzia Ltda',
        nomeFantasia: null,
        cnpj: '14288902000144',
        situacao: 'EM_DIA',
      },
      valorMensal: 185,
      valorAnual: 1776,
      recorrente: false,
      cancelamentoPendente: false,
      boleto: null,
    });
    abrir('/associado/filiacao');
    const confirmar = await screen.findByRole('button', {
      name: 'Confirmar Pedido de Cancelamento',
    });
    await waitFor(() => expect(confirmar).toBeDisabled());
    fireEvent.click(screen.getByRole('checkbox'));
    expect(confirmar).toBeEnabled();
  });

  it('/admin avisa quando não há sessão da sede', async () => {
    abrir('/admin');
    expect((await screen.findAllByRole('alert'))[0]).toHaveTextContent(
      'Entre com sua conta',
    );
  });

  it('/status avisa quando a API não responde', async () => {
    vi.mocked(api.getHealth).mockRejectedValue(new Error('sem conexão'));
    abrir('/status');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A API não respondeu',
    );
  });
});
