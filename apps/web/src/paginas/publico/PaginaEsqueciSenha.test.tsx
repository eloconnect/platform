import type { ApiClient } from '@eloconnect/shared';
import { ApiError } from '@eloconnect/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../api';
import { PaginaEsqueciSenha } from './PaginaEsqueciSenha';

vi.mock('../../api', () => ({
  api: {
    solicitarRecuperacaoSenha: vi.fn<ApiClient['solicitarRecuperacaoSenha']>(),
  },
}));

const MENSAGEM_GENERICA =
  'Não foi possível enviar o pedido agora. Tente de novo em alguns minutos.';

function preencherEEnviar() {
  render(
    <MemoryRouter>
      <PaginaEsqueciSenha />
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByLabelText(/^E-mail/), {
    target: { value: 'maria@farmacia.com.br' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Enviar link de recuperação' }),
  );
}

describe('PaginaEsqueciSenha', () => {
  beforeEach(() => {
    vi.mocked(api.solicitarRecuperacaoSenha).mockReset();
  });

  it('com sucesso mostra a mensagem da API', async () => {
    vi.mocked(api.solicitarRecuperacaoSenha).mockResolvedValue({
      mensagem:
        'Se o e-mail estiver cadastrado, enviaremos um link para redefinir a senha.',
    });
    preencherEEnviar();

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Se o e-mail estiver cadastrado, enviaremos um link para redefinir a senha.',
    );
    expect(api.solicitarRecuperacaoSenha).toHaveBeenCalledWith({
      email: 'maria@farmacia.com.br',
    });
  });

  it('com 400 pede para conferir o e-mail', async () => {
    vi.mocked(api.solicitarRecuperacaoSenha).mockRejectedValue(
      new ApiError(400, 'erro'),
    );
    preencherEEnviar();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Confira o e-mail digitado e tente de novo.',
    );
  });

  it('com outro status mostra a mensagem genérica', async () => {
    vi.mocked(api.solicitarRecuperacaoSenha).mockRejectedValue(
      new ApiError(500, 'erro'),
    );
    preencherEEnviar();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      MENSAGEM_GENERICA,
    );
  });

  it('com falha de rede mostra a mensagem genérica em português', async () => {
    vi.mocked(api.solicitarRecuperacaoSenha).mockRejectedValue(
      new TypeError('Failed to fetch'),
    );
    preencherEEnviar();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      MENSAGEM_GENERICA,
    );
  });
});
