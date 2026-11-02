import type { ApiClient, BoletoHistorico } from '@eloconnect/shared';
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../api';
import { PaginaHistoricoAssociado } from './PaginaHistoricoAssociado';

vi.mock('../../api', () => ({
  api: {
    listarMeuHistorico: vi.fn<ApiClient['listarMeuHistorico']>(),
  },
}));

const JULHO: BoletoHistorico = {
  id: 'boleto-07',
  competencia: { ano: 2099, mes: 7 },
  tipo: 'MENSAL',
  valor: '130.00',
  vencimento: '2099-07-10',
  status: 'EM_ABERTO',
  vencido: true,
  pagoEm: null,
  formaPagamento: null,
};

const JUNHO: BoletoHistorico = {
  ...JULHO,
  id: 'boleto-06',
  competencia: { ano: 2099, mes: 6 },
  tipo: 'AVULSO',
  vencimento: '2099-06-10',
  status: 'PAGO',
  vencido: false,
  pagoEm: '2099-06-08T15:00:00.000Z',
  formaPagamento: 'PIX',
};

describe('PaginaHistoricoAssociado', () => {
  beforeEach(() => {
    vi.mocked(api.listarMeuHistorico).mockResolvedValue([JULHO, JUNHO]);
  });

  it('mostra cada boleto com valor, vencimento e situação em texto claro', async () => {
    render(<PaginaHistoricoAssociado />);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Histórico de pagamentos',
      }),
    ).toBeInTheDocument();
    const [julho, junho] = await screen.findAllByRole('listitem');
    expect(
      within(julho).getByRole('heading', {
        level: 2,
        name: 'Boleto de julho de 2099',
      }),
    ).toBeInTheDocument();
    expect(julho).toHaveTextContent(/Valor: R\$\s130,00/);
    expect(julho).toHaveTextContent('Vencimento: 10/07/2099');
    expect(julho).toHaveTextContent('Situação: Vencido');

    expect(
      within(junho).getByRole('heading', {
        level: 2,
        name: 'Boleto de junho de 2099 (avulso)',
      }),
    ).toBeInTheDocument();
    expect(junho).toHaveTextContent('Situação: Pago em 08/06/2099, com Pix');
  });

  it('avisa quando ainda não há boleto', async () => {
    vi.mocked(api.listarMeuHistorico).mockResolvedValue([]);

    render(<PaginaHistoricoAssociado />);

    expect(await screen.findByText('Nenhum boleto ainda.')).toBeInTheDocument();
  });

  it('avisa quando o histórico não carrega', async () => {
    vi.mocked(api.listarMeuHistorico).mockRejectedValue(new Error('falhou'));

    render(<PaginaHistoricoAssociado />);

    expect(
      await screen.findByText(/Não foi possível carregar os boletos agora/),
    ).toBeInTheDocument();
  });
});
