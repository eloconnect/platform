import type { ApiClient } from '@eloconnect/shared';
import { ApiError } from '@eloconnect/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../api';
import { PaginaEntrar } from './PaginaEntrar';

vi.mock('../../api', () => ({
  api: { login: vi.fn<ApiClient['login']>() },
}));

function preencherEEnviar() {
  render(
    <MemoryRouter>
      <PaginaEntrar />
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByLabelText(/^E-mail/), {
    target: { value: 'maria@farmacia.com.br' },
  });
  fireEvent.change(screen.getByLabelText(/^Senha/), {
    target: { value: 'senha-segura' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
}

describe('PaginaEntrar', () => {
  beforeEach(() => {
    vi.mocked(api.login).mockReset();
  });

  it.each([
    [401, 'E-mail ou senha incorretos.'],
    [500, 'Não foi possível entrar agora. Tente de novo em alguns minutos.'],
  ])('com status %i mostra "%s"', async (status, mensagem) => {
    vi.mocked(api.login).mockRejectedValue(new ApiError(status, 'erro'));
    preencherEEnviar();
    expect(await screen.findByRole('alert')).toHaveTextContent(mensagem);
  });

  it('com falha de rede mostra a mensagem genérica em português', async () => {
    vi.mocked(api.login).mockRejectedValue(new TypeError('Failed to fetch'));
    preencherEEnviar();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível entrar agora. Tente de novo em alguns minutos.',
    );
  });
});
