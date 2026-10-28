import type { ApiClient } from '@eloconnect/shared';
import { ApiError } from '@eloconnect/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../api';
import { PaginaCadastro } from './PaginaCadastro';

vi.mock('../../api', () => ({
  api: { criarConta: vi.fn<ApiClient['criarConta']>() },
}));

const MENSAGEM =
  'Se o CNPJ estiver no cadastro do sindicato, enviamos um link para o e-mail da farmácia que está no cadastro.';

function preencherEEnviar(cnpj = '11.222.333/0001-81') {
  render(
    <MemoryRouter>
      <PaginaCadastro />
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByLabelText(/^CNPJ da farmácia/), {
    target: { value: cnpj },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Enviar link para criar a senha' }),
  );
}

describe('PaginaCadastro', () => {
  beforeEach(() => {
    vi.mocked(api.criarConta).mockReset();
  });

  it('com sucesso mostra a mensagem da API e o que fazer se o e-mail não chegar', async () => {
    vi.mocked(api.criarConta).mockResolvedValue({ mensagem: MENSAGEM });
    preencherEEnviar();

    expect(await screen.findByRole('status')).toHaveTextContent(MENSAGEM);
    expect(screen.getByText(/fale com a sede do sindicato/)).toBeVisible();
    expect(api.criarConta).toHaveBeenCalledWith({
      cnpj: '11.222.333/0001-81',
    });
  });

  it('com CNPJ inválido avisa no campo e não chama a API', () => {
    preencherEEnviar('11.222.333/0001-00');

    expect(
      screen.getByLabelText(/^CNPJ da farmácia/),
    ).toHaveAccessibleDescription(
      'CNPJ inválido. Confira os números digitados.',
    );
    expect(api.criarConta).not.toHaveBeenCalled();
  });

  it('com outro status mostra a mensagem genérica', async () => {
    vi.mocked(api.criarConta).mockRejectedValue(new ApiError(500, 'erro'));
    preencherEEnviar();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível enviar o pedido agora. Tente de novo em alguns minutos.',
    );
  });
});
