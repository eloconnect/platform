import type { ApiClient } from '@eloconnect/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../api';
import { PaginaFiliaisAssociado } from './PaginaFiliaisAssociado';

vi.mock('../../api', () => ({
  api: {
    listarFiliais: vi.fn<ApiClient['listarFiliais']>(),
    baixarPdfBoletoFilial: vi.fn<ApiClient['baixarPdfBoletoFilial']>(),
    baixarPdfMeuBoleto: vi.fn<ApiClient['baixarPdfMeuBoleto']>(),
  },
}));

describe('PaginaFiliaisAssociado', () => {
  beforeEach(() => {
    vi.mocked(api.listarFiliais).mockResolvedValue([
      {
        id: 'f1',
        cnpj: '11222333000281',
        nome: 'Drogaria Exemplo Filial',
        situacao: 'Inadimplente',
        boletos: [
          {
            id: 'b1',
            competencia: { ano: 2026, mes: 11 },
            valor: '120.00',
            vencimento: '2026-11-10',
            validoAte: '2026-12-10',
            vencido: true,
            linhaDigitavel: '00000.00000 00000.000000 00000.000000 0 0',
            pixCopiaECola: '00020126-pix-ficticio',
          },
        ],
      },
      {
        id: 'f2',
        cnpj: '11222333000362',
        nome: 'Drogaria Exemplo Bairro',
        situacao: 'Adimplente',
        boletos: [],
      },
    ]);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('mostra cada filial e baixa o PDF do boleto dela (RN31)', async () => {
    vi.mocked(api.baixarPdfBoletoFilial).mockResolvedValue(new Blob(['%PDF-']));
    vi.stubGlobal(
      'open',
      vi.fn(() => window),
    );
    render(<PaginaFiliaisAssociado />);

    expect(
      await screen.findByRole('heading', { name: 'Drogaria Exemplo Filial' }),
    ).toBeVisible();
    expect(screen.getByText('CNPJ 11.222.333/0002-81')).toBeVisible();
    expect(screen.getByText('Nenhum boleto em aberto.')).toBeVisible();

    await userEvent.click(screen.getByRole('button', { name: /PDF/ }));

    expect(api.baixarPdfBoletoFilial).toHaveBeenCalledWith('f1', 'b1');
    expect(api.baixarPdfMeuBoleto).not.toHaveBeenCalled();
  });
});
