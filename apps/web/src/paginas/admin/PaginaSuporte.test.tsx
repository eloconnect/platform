import type { ApiClient, PedidoSuporte } from '@eloconnect/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../api';
import { PaginaSuporte } from './PaginaSuporte';

vi.mock('../../api', () => ({
  api: {
    listarSuporte: vi.fn<ApiClient['listarSuporte']>(),
    marcarSuporteRespondido: vi.fn<ApiClient['marcarSuporteRespondido']>(),
  },
}));

const PEDIDO: PedidoSuporte = {
  id: 's1',
  associado: {
    id: 'a1',
    razaoSocial: 'Farmácia Exemplo Ltda',
    email: 'farmacia@example.com',
  },
  assunto: 'Dúvida sobre férias',
  mensagem: 'Como calcular?',
  criadoEm: '2026-11-20T12:00:00.000Z',
  respondidoEm: null,
  respondidoPor: null,
};

describe('PaginaSuporte', () => {
  beforeEach(() => {
    vi.mocked(api.listarSuporte).mockResolvedValue([PEDIDO]);
  });

  it('mostra o pedido e marca como respondido (RF25)', async () => {
    vi.mocked(api.marcarSuporteRespondido).mockResolvedValue({
      ...PEDIDO,
      respondidoEm: '2026-11-21T12:00:00.000Z',
      respondidoPor: 'Atendente',
    });
    render(
      <MemoryRouter>
        <PaginaSuporte />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Como calcular?')).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Farmácia Exemplo Ltda' }),
    ).toHaveAttribute('href', '/admin/associados/a1');

    await userEvent.click(
      screen.getByRole('button', {
        name: 'Marcar como respondido: Dúvida sobre férias',
      }),
    );

    expect(api.marcarSuporteRespondido).toHaveBeenCalledWith('s1');
    expect(await screen.findByText(/por Atendente/)).toBeVisible();
  });
});
