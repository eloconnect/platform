import type { ApiClient, SituacaoAnual } from '@eloconnect/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../api';
import { lerAviso } from '../../componentes';
import { PaginaAnualAssociado } from './PaginaAnualAssociado';

vi.mock('../../api', () => ({
  api: {
    situacaoAnual: vi.fn<ApiClient['situacaoAnual']>(),
    pedirAnual: vi.fn<ApiClient['pedirAnual']>(),
  },
}));

const PODE: SituacaoAnual = {
  motivo: null,
  valorAnual: '1152.00',
  valorMensal: '120.00',
  primeiroMes: { ano: 2026, mes: 11 },
  ultimoMes: { ano: 2027, mes: 10 },
  vencimento: '2026-12-05',
  emDiaAte: '2027-12-10',
  planoAte: null,
};

function DestinoBoletos() {
  return <p>Destino: {lerAviso(useLocation().state)}</p>;
}

function abrir() {
  render(
    <MemoryRouter initialEntries={['/associado/anual']}>
      <Routes>
        <Route path="/associado/anual" element={<PaginaAnualAssociado />} />
        <Route path="/associado/boletos" element={<DestinoBoletos />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PaginaAnualAssociado', () => {
  beforeEach(() => {
    vi.mocked(api.situacaoAnual).mockResolvedValue(PODE);
    vi.mocked(api.pedirAnual).mockReset();
  });

  it('mostra os meses, o valor e a economia, e gera o boleto (RN13)', async () => {
    vi.mocked(api.pedirAnual).mockResolvedValue({ boletoId: 'b1' });
    abrir();

    expect(
      await screen.findByRole('heading', {
        name: 'De novembro de 2026 a outubro de 2027',
      }),
    ).toBeVisible();
    expect(screen.getByText('R$ 1.152,00')).toBeVisible();
    expect(screen.getByText(/economiza R\$\s288,00/)).toBeVisible();

    await userEvent.click(
      screen.getByRole('button', { name: 'Gerar o boleto do ano' }),
    );

    expect(
      await screen.findByText(/Destino: Pronto! O boleto do plano anual/),
    ).toBeVisible();
  });

  it('com o plano em vigor, diz até quando ele vale', async () => {
    vi.mocked(api.situacaoAnual).mockResolvedValue({
      ...PODE,
      motivo: 'PLANO_EM_VIGOR',
      planoAte: { ano: 2027, mes: 10 },
    });
    abrir();

    expect(
      await screen.findByText('O plano anual da farmácia ainda está valendo.'),
    ).toBeVisible();
    expect(screen.getByText('outubro de 2027')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Gerar o boleto do ano' }),
    ).not.toBeInTheDocument();
  });
});
