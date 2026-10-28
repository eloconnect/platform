import type { ApiClient } from '@eloconnect/shared';
import { ApiError } from '@eloconnect/shared';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../api';
import { PaginaInicioAssociado } from './PaginaInicioAssociado';

vi.mock('../../api', () => ({
  api: { minhaConta: vi.fn<ApiClient['minhaConta']>() },
}));

describe('PaginaInicioAssociado', () => {
  beforeEach(() => {
    vi.mocked(api.minhaConta).mockReset();
  });

  it('mostra a situação, sem aviso quando não há liberação', async () => {
    vi.mocked(api.minhaConta).mockResolvedValue({
      nome: 'Drogaria Exemplo',
      situacao: 'Sem contribuição ativa',
      acessoLiberadoAte: null,
    });
    render(<PaginaInicioAssociado />);

    expect(await screen.findByText('Drogaria Exemplo')).toBeInTheDocument();
    expect(
      screen.getByText('Situação: Sem contribuição ativa'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /Acesso liberado/ }),
    ).not.toBeInTheDocument();
  });

  it('com a liberação da sede em vigor, avisa até quando ela vale (RN11)', async () => {
    vi.mocked(api.minhaConta).mockResolvedValue({
      nome: 'Drogaria Exemplo',
      situacao: 'Inadimplente',
      acessoLiberadoAte: '2026-11-04T12:00:00.000Z',
    });
    render(<PaginaInicioAssociado />);

    expect(
      await screen.findByRole('heading', {
        name: 'Acesso liberado pela sede até 04/11/2026',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/o acesso volta a depender do pagamento em dia/),
    ).toBeInTheDocument();
  });

  it('avisa quando a API não responde', async () => {
    vi.mocked(api.minhaConta).mockRejectedValue(new ApiError(500, 'erro'));
    render(<PaginaInicioAssociado />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar os seus dados agora.',
    );
  });
});
