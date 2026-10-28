import type { ApiClient } from '@eloconnect/shared';
import { ApiError } from '@eloconnect/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../api';
import { PaginaRedefinirSenha } from './PaginaRedefinirSenha';

vi.mock('../../api', () => ({
  api: {
    redefinirSenha: vi.fn<ApiClient['redefinirSenha']>(),
    confirmarConta: vi.fn<ApiClient['confirmarConta']>(),
  },
}));

const MENSAGEM_GENERICA =
  'Não foi possível redefinir a senha agora. Tente de novo em alguns minutos.';

function abrir(endereco = '/redefinir-senha?token=token-de-teste') {
  render(
    <MemoryRouter initialEntries={[endereco]}>
      <PaginaRedefinirSenha />
    </MemoryRouter>,
  );
}

function preencherEEnviar(senha = 'senha-nova-segura', confirmacao = senha) {
  fireEvent.change(screen.getByLabelText(/^Nova senha/), {
    target: { value: senha },
  });
  fireEvent.change(screen.getByLabelText(/^Repita a nova senha/), {
    target: { value: confirmacao },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }));
}

describe('PaginaRedefinirSenha', () => {
  beforeEach(() => {
    vi.mocked(api.redefinirSenha).mockReset();
    vi.mocked(api.confirmarConta).mockReset();
  });

  it('com sucesso mostra o aviso e o link para entrar', async () => {
    vi.mocked(api.redefinirSenha).mockResolvedValue({
      mensagem: 'Senha redefinida com sucesso.',
    });
    abrir();
    preencherEEnviar();

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Senha redefinida',
    );
    expect(
      screen.getByRole('link', { name: 'Ir para o login' }),
    ).toHaveAttribute('href', '/entrar');
    expect(api.redefinirSenha).toHaveBeenCalledWith({
      token: 'token-de-teste',
      senha: 'senha-nova-segura',
    });
  });

  it('com 400 avisa que o link expirou e oferece pedir outro', async () => {
    vi.mocked(api.redefinirSenha).mockRejectedValue(new ApiError(400, 'erro'));
    abrir();
    preencherEEnviar();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Este link expirou ou já foi usado. Peça um novo link.',
    );
    expect(
      screen.getByRole('link', { name: 'Pedir um novo link' }),
    ).toHaveAttribute('href', '/esqueci-senha');
  });

  it('com outro status mostra a mensagem genérica', async () => {
    vi.mocked(api.redefinirSenha).mockRejectedValue(new ApiError(500, 'erro'));
    abrir();
    preencherEEnviar();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      MENSAGEM_GENERICA,
    );
  });

  it('com falha de rede mostra a mensagem genérica em português', async () => {
    vi.mocked(api.redefinirSenha).mockRejectedValue(
      new TypeError('Failed to fetch'),
    );
    abrir();
    preencherEEnviar();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      MENSAGEM_GENERICA,
    );
  });

  it('não envia quando as senhas são diferentes', () => {
    abrir();
    preencherEEnviar('senha-nova-segura', 'outra-senha-qualquer');

    expect(screen.getByText('As senhas não são iguais.')).toBeInTheDocument();
    expect(api.redefinirSenha).not.toHaveBeenCalled();
  });

  it('sem token no endereço mostra o link inválido', () => {
    abrir('/redefinir-senha');

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Este link não é válido. Peça um novo link.',
    );
    expect(
      screen.getByRole('link', { name: 'Pedir um novo link' }),
    ).toHaveAttribute('href', '/esqueci-senha');
  });

  describe('criar a senha da conta nova', () => {
    function abrirCriar(endereco = '/criar-senha?token=token-de-teste') {
      render(
        <MemoryRouter initialEntries={[endereco]}>
          <PaginaRedefinirSenha variante="criar" />
        </MemoryRouter>,
      );
    }

    function preencherECriar(senha = 'senha-nova-segura') {
      fireEvent.change(screen.getByLabelText(/^Senha/), {
        target: { value: senha },
      });
      fireEvent.change(screen.getByLabelText(/^Repita a senha/), {
        target: { value: senha },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Criar senha' }));
    }

    it('com sucesso avisa que a conta foi criada', async () => {
      vi.mocked(api.confirmarConta).mockResolvedValue({
        mensagem: 'Conta criada. Já pode entrar com o e-mail e a senha.',
      });
      abrirCriar();
      expect(
        screen.getByRole('heading', { name: 'Crie sua senha' }),
      ).toBeInTheDocument();
      preencherECriar();

      expect(await screen.findByRole('status')).toHaveTextContent(
        'Conta criada',
      );
      expect(api.confirmarConta).toHaveBeenCalledWith({
        token: 'token-de-teste',
        senha: 'senha-nova-segura',
      });
      expect(api.redefinirSenha).not.toHaveBeenCalled();
    });

    it('com 400 oferece pedir outro link em Criar conta', async () => {
      vi.mocked(api.confirmarConta).mockRejectedValue(
        new ApiError(400, 'erro'),
      );
      abrirCriar();
      preencherECriar();

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Este link expirou ou já foi usado. Peça um novo link.',
      );
      expect(
        screen.getByRole('link', { name: 'Pedir um novo link' }),
      ).toHaveAttribute('href', '/cadastro');
    });
  });
});
