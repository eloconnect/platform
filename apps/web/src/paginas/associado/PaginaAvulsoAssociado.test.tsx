import type { ApiClient } from '@eloconnect/shared';
import { ApiError } from '@eloconnect/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../api';
import { lerAviso } from '../../componentes';
import { PaginaAvulsoAssociado } from './PaginaAvulsoAssociado';

vi.mock('../../api', () => ({
  api: {
    situacaoAvulso: vi.fn<ApiClient['situacaoAvulso']>(),
    pedirAvulso: vi.fn<ApiClient['pedirAvulso']>(),
  },
}));

/** No lugar de "Meus boletos": mostra o aviso que o pedido deixou. */
function DestinoBoletos() {
  return <p>Destino: {lerAviso(useLocation().state)}</p>;
}

function abrir() {
  render(
    <MemoryRouter initialEntries={['/associado/avulso']}>
      <Routes>
        <Route path="/associado/avulso" element={<PaginaAvulsoAssociado />} />
        <Route path="/associado/boletos" element={<DestinoBoletos />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PaginaAvulsoAssociado', () => {
  beforeEach(() => {
    vi.mocked(api.situacaoAvulso).mockResolvedValue({
      motivo: null,
      valor: '120.00',
      vencimento: '2026-11-21',
      emDiaAte: '2027-01-09',
    });
    vi.mocked(api.pedirAvulso).mockReset();
  });

  it('mostra o valor, o vencimento e até quando fica em dia, e gera o boleto (RN24)', async () => {
    vi.mocked(api.pedirAvulso).mockResolvedValue({ boletoId: 'b1' });
    abrir();

    expect(await screen.findByText(/R\$\s120,00/)).toBeVisible();
    expect(screen.getByText('21/11/2026')).toBeVisible();
    expect(screen.getByText('09/01/2027')).toBeVisible();
    expect(screen.getByText(/não chega por e-mail/)).toBeVisible();

    await userEvent.click(
      screen.getByRole('button', { name: 'Gerar o boleto' }),
    );

    expect(api.pedirAvulso).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText(
        'Destino: Pronto! O boleto deste mês está aqui. Ele não chega por e-mail.',
      ),
    ).toBeVisible();
  });

  it('explica por que não dá para pedir, sem o botão', async () => {
    vi.mocked(api.situacaoAvulso).mockResolvedValue({
      motivo: 'BOLETO_EXPIRADO',
      valor: '120.00',
      vencimento: '2026-11-21',
      emDiaAte: '2027-01-09',
    });
    abrir();

    expect(await screen.findByText(/tem meses em aberto/)).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Gerar o boleto' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Pagar os meses em aberto' }),
    ).toHaveAttribute('href', '/associado/meses-em-aberto');
  });

  it('mostra o erro da API e deixa tentar de novo', async () => {
    vi.mocked(api.pedirAvulso).mockRejectedValue(
      new ApiError(409, 'A farmácia já tem um boleto para pagar.'),
    );
    abrir();

    await userEvent.click(
      await screen.findByRole('button', { name: 'Gerar o boleto' }),
    );

    expect(
      await screen.findByText('A farmácia já tem um boleto para pagar.'),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Gerar o boleto' }),
    ).toBeEnabled();
  });
});
