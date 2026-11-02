import type { ApiClient } from '@eloconnect/shared';
import { ApiError } from '@eloconnect/shared';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../api';
import { PaginaInicioAssociado } from './PaginaInicioAssociado';

vi.mock('../../api', () => ({
  api: { minhaConta: vi.fn<ApiClient['minhaConta']>() },
}));

function abrir(state?: unknown) {
  render(
    <MemoryRouter initialEntries={[{ pathname: '/associado', state }]}>
      <PaginaInicioAssociado />
    </MemoryRouter>,
  );
}

describe('PaginaInicioAssociado', () => {
  beforeEach(() => {
    vi.mocked(api.minhaConta).mockReset();
  });

  it('mostra a situação, sem aviso quando não há liberação', async () => {
    vi.mocked(api.minhaConta).mockResolvedValue({
      nome: 'Drogaria Exemplo',
      situacao: 'Sem contribuição ativa',
      acessoLiberadoAte: null,
      recebeBoletoMensal: false,
      cancelamentoPedidoEm: null,
    });
    abrir();

    expect(await screen.findByText('Drogaria Exemplo')).toBeInTheDocument();
    expect(
      screen.getByText('Situação: Sem contribuição ativa'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /Acesso liberado/ }),
    ).not.toBeInTheDocument();
    // Quem não recebe o boleto vê o convite para aderir (RN23).
    expect(
      screen.getByRole('link', { name: 'Quero receber o boleto todo mês' }),
    ).toHaveAttribute('href', '/associado/adesao');
  });

  it('com a liberação da sede em vigor, avisa até quando ela vale (RN11)', async () => {
    vi.mocked(api.minhaConta).mockResolvedValue({
      nome: 'Drogaria Exemplo',
      situacao: 'Inadimplente',
      acessoLiberadoAte: '2026-11-04T12:00:00.000Z',
      recebeBoletoMensal: true,
      cancelamentoPedidoEm: null,
    });
    abrir();

    expect(
      await screen.findByRole('heading', {
        name: 'Acesso liberado pela sede até 04/11/2026',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/o acesso volta a depender do pagamento em dia/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Quero receber o boleto todo mês' }),
    ).not.toBeInTheDocument();
  });

  it('quem recebe o boleto vê o caminho para cancelar (RF26)', async () => {
    vi.mocked(api.minhaConta).mockResolvedValue({
      nome: 'Drogaria Exemplo',
      situacao: 'Adimplente',
      acessoLiberadoAte: null,
      recebeBoletoMensal: true,
      cancelamentoPedidoEm: null,
    });
    abrir();

    expect(
      await screen.findByRole('link', { name: 'Cancelar o boleto mensal' }),
    ).toHaveAttribute('href', '/associado/cancelamento');
    expect(
      screen.getByText('A farmácia recebe o boleto da contribuição todo mês.'),
    ).toBeInTheDocument();
  });

  it('com o pedido de cancelamento enviado, mostra o prazo da sede (RN18)', async () => {
    vi.mocked(api.minhaConta).mockResolvedValue({
      nome: 'Drogaria Exemplo',
      situacao: 'Adimplente',
      acessoLiberadoAte: null,
      recebeBoletoMensal: true,
      cancelamentoPedidoEm: '2026-11-02T15:00:00.000Z',
    });
    abrir({ aviso: 'Pedido de cancelamento enviado.' });

    expect(
      await screen.findByText(
        /O cancelamento do boleto mensal foi pedido em 02\/11\/2026\. A sede do sindicato tem 15 dias para responder\./,
      ),
    ).toBeInTheDocument();
    // Depois de carregar, o único aviso é o do pedido enviado.
    expect(screen.getByRole('status')).toHaveTextContent(
      'Pedido de cancelamento enviado.',
    );
    expect(
      screen.queryByRole('link', { name: 'Cancelar o boleto mensal' }),
    ).not.toBeInTheDocument();
  });

  it('avisa quando a API não responde', async () => {
    vi.mocked(api.minhaConta).mockRejectedValue(new ApiError(500, 'erro'));
    abrir();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar os seus dados agora.',
    );
  });
});
