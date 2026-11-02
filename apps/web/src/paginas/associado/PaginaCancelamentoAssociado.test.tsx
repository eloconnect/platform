import type { ApiClient, Beneficio, MinhaConta } from '@eloconnect/shared';
import { ApiError } from '@eloconnect/shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../api';
import { lerAviso } from '../../componentes';
import { PaginaCancelamentoAssociado } from './PaginaCancelamentoAssociado';

vi.mock('../../api', () => ({
  api: {
    minhaConta: vi.fn<ApiClient['minhaConta']>(),
    listarBeneficios: vi.fn<ApiClient['listarBeneficios']>(),
    pedirCancelamento: vi.fn<ApiClient['pedirCancelamento']>(),
  },
}));

const CONTA: MinhaConta = {
  nome: 'Drogaria Exemplo',
  situacao: 'Adimplente',
  acessoLiberadoAte: null,
  recebeBoletoMensal: true,
  cancelamentoPedidoEm: null,
};

const BENEFICIOS: Beneficio[] = [
  {
    id: 'b-1',
    titulo: 'Consultoria tributária',
    descricao: 'Texto',
    grupo: 'CONSULTORIA',
  },
  {
    id: 'b-2',
    titulo: 'Orientação trabalhista',
    descricao: 'Texto',
    grupo: 'ASSESSORIA_JURIDICA',
  },
];

/** O início, só para conferir o aviso deixado pelo pedido. */
function Inicio() {
  return <p>Início: {lerAviso(useLocation().state)}</p>;
}

function abrir() {
  render(
    <MemoryRouter initialEntries={['/associado/cancelamento']}>
      <Routes>
        <Route
          path="/associado/cancelamento"
          element={<PaginaCancelamentoAssociado />}
        />
        <Route path="/associado" element={<Inicio />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PaginaCancelamentoAssociado', () => {
  beforeEach(() => {
    vi.mocked(api.minhaConta).mockResolvedValue(CONTA);
    vi.mocked(api.listarBeneficios).mockResolvedValue(BENEFICIOS);
    vi.mocked(api.pedirCancelamento).mockReset();
  });

  it('antes de pedir, mostra os benefícios e o suporte que a farmácia perde', async () => {
    abrir();

    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: 'O que a farmácia perde',
      }),
    ).toBeInTheDocument();
    // Os grupos aparecem na ordem do cadastro de benefícios.
    expect(
      screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent),
    ).toEqual(['Assessoria jurídica', 'Consultoria', 'Suporte e convenções']);
    const juridica = screen
      .getByRole('heading', { name: 'Assessoria jurídica' })
      .closest('section');
    expect(
      within(juridica ?? document.body).getByText('Orientação trabalhista'),
    ).toBeInTheDocument();
    expect(screen.getByText('O suporte do sindicato')).toBeInTheDocument();
    expect(
      screen.getByText(/A sede do sindicato tem 15 dias para responder/),
    ).toBeInTheDocument();
    expect(api.pedirCancelamento).not.toHaveBeenCalled();
  });

  it('envia o pedido e volta ao início com o aviso', async () => {
    vi.mocked(api.pedirCancelamento).mockResolvedValue({
      pedidoEm: '2026-11-02T15:00:00.000Z',
    });
    abrir();

    await userEvent.click(
      await screen.findByRole('button', { name: 'Pedir o cancelamento' }),
    );

    expect(api.pedirCancelamento).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText('Início: Pedido de cancelamento enviado.'),
    ).toBeInTheDocument();
  });

  it('mostra o motivo quando a API recusa o pedido', async () => {
    vi.mocked(api.pedirCancelamento).mockRejectedValue(
      new ApiError(
        409,
        'O pedido de cancelamento já foi enviado. A sede vai responder.',
      ),
    );
    abrir();

    await userEvent.click(
      await screen.findByRole('button', { name: 'Pedir o cancelamento' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'O pedido de cancelamento já foi enviado. A sede vai responder.',
    );
    expect(
      screen.getByRole('button', { name: 'Pedir o cancelamento' }),
    ).toBeEnabled();
  });

  it('com o pedido já enviado, só mostra a data e o prazo', async () => {
    vi.mocked(api.minhaConta).mockResolvedValue({
      ...CONTA,
      cancelamentoPedidoEm: '2026-11-02T15:00:00.000Z',
    });
    abrir();

    expect(
      await screen.findByText(/O cancelamento já foi pedido em 02\/11\/2026\./),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Pedir o cancelamento' }),
    ).not.toBeInTheDocument();
  });

  it('quem não recebe o boleto não tem o que cancelar', async () => {
    vi.mocked(api.minhaConta).mockResolvedValue({
      ...CONTA,
      recebeBoletoMensal: false,
    });
    abrir();

    expect(
      await screen.findByText(
        'A farmácia não recebe o boleto mensal, então não há o que cancelar.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Voltar ao início' }),
    ).toHaveAttribute('href', '/associado');
  });

  it('avisa quando a página não carrega', async () => {
    vi.mocked(api.listarBeneficios).mockRejectedValue(
      new TypeError('Failed to fetch'),
    );
    abrir();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar esta página agora.',
    );
  });
});
