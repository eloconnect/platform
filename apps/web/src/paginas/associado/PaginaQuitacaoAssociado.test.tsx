import type { ApiClient, SituacaoQuitacao } from '@eloconnect/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../api';
import { PaginaQuitacaoAssociado } from './PaginaQuitacaoAssociado';

vi.mock('../../api', () => ({
  api: {
    situacaoQuitacao: vi.fn<ApiClient['situacaoQuitacao']>(),
    pedirQuitacao: vi.fn<ApiClient['pedirQuitacao']>(),
  },
}));

const COM_MESES: SituacaoQuitacao = {
  meses: [
    { competencia: { ano: 2026, mes: 8 }, valor: '120.00' },
    { competencia: { ano: 2026, mes: 9 }, valor: '130.00' },
  ],
  total: '250.00',
  pedido: null,
  boletoEmAberto: false,
};

function abrir() {
  render(
    <MemoryRouter>
      <PaginaQuitacaoAssociado />
    </MemoryRouter>,
  );
}

describe('PaginaQuitacaoAssociado', () => {
  beforeEach(() => {
    vi.mocked(api.situacaoQuitacao).mockReset();
    vi.mocked(api.pedirQuitacao).mockReset();
  });

  it('mostra os meses e o total, e envia o pedido para a sede (RN30)', async () => {
    vi.mocked(api.situacaoQuitacao).mockResolvedValue(COM_MESES);
    vi.mocked(api.pedirQuitacao).mockResolvedValue({
      ...COM_MESES,
      pedido: {
        status: 'PENDENTE',
        solicitadoEm: '2026-11-20T12:00:00.000Z',
        decididoEm: null,
      },
    });
    abrir();

    expect(await screen.findByText('agosto de 2026')).toBeVisible();
    expect(screen.getByText('R$ 250,00')).toBeVisible();

    await userEvent.click(
      screen.getByRole('button', {
        name: 'Pedir o boleto dos meses em aberto',
      }),
    );

    expect(
      await screen.findByText('Pedido enviado. A sede vai responder.'),
    ).toBeVisible();
    expect(
      screen.getByText(/O pedido foi enviado em 20\/11\/2026/),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', {
        name: 'Pedir o boleto dos meses em aberto',
      }),
    ).not.toBeInTheDocument();
  });

  it('com o boleto já gerado, leva a "Meus boletos"', async () => {
    vi.mocked(api.situacaoQuitacao).mockResolvedValue({
      ...COM_MESES,
      meses: [],
      boletoEmAberto: true,
    });
    abrir();

    expect(
      await screen.findByText(/O boleto dos meses em aberto já saiu/),
    ).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Ver meus boletos' }),
    ).toHaveAttribute('href', '/associado/boletos');
  });

  it('sem meses em aberto, diz que não há nada a pedir', async () => {
    vi.mocked(api.situacaoQuitacao).mockResolvedValue({
      ...COM_MESES,
      meses: [],
      total: '0.00',
    });
    abrir();

    expect(
      await screen.findByText(/A farmácia não tem meses em aberto/),
    ).toBeVisible();
  });
});
