import type { ApiClient } from '@eloconnect/shared';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../api';
import { entrarComo } from '../../test/sessao';
import { PaginaInicioAdmin } from './PaginaInicioAdmin';

vi.mock('../../api', () => ({
  api: {
    listarAssociados: vi.fn<ApiClient['listarAssociados']>(),
    listarPedidosQuitacao: vi.fn<ApiClient['listarPedidosQuitacao']>(),
    listarSuporte: vi.fn<ApiClient['listarSuporte']>(),
  },
}));

function abrir() {
  render(
    <MemoryRouter>
      <PaginaInicioAdmin />
    </MemoryRouter>,
  );
}

const lista = (total: number) => ({
  itens: [],
  total,
  pagina: 1,
  porPagina: 20,
});

describe('PaginaInicioAdmin', () => {
  beforeEach(() => {
    entrarComo('ADMIN');
    vi.mocked(api.listarAssociados).mockReset();
    vi.mocked(api.listarPedidosQuitacao).mockReset();
    vi.mocked(api.listarPedidosQuitacao).mockResolvedValue([]);
    vi.mocked(api.listarSuporte).mockResolvedValue([]);
  });

  it('os dois perfis veem os pedidos de suporte sem resposta (RF25)', async () => {
    entrarComo('ADMIN_BASICO');
    const pedido = {
      id: 's1',
      associado: { id: 'a1', razaoSocial: 'Farmácia', email: null },
      assunto: 'Dúvida',
      mensagem: 'Texto',
      criadoEm: '2026-11-20T12:00:00.000Z',
      respondidoPor: null,
    };
    vi.mocked(api.listarSuporte).mockResolvedValue([
      { ...pedido, respondidoEm: null },
      { ...pedido, id: 's2', respondidoEm: '2026-11-21T12:00:00.000Z' },
    ]);
    abrir();

    expect(
      await screen.findByRole('heading', {
        name: '1 pedido de suporte espera resposta',
      }),
    ).toBeVisible();
  });

  it('o chave mestre vê os pedidos do boleto dos meses em aberto (RN30)', async () => {
    vi.mocked(api.listarAssociados).mockResolvedValue(lista(0));
    vi.mocked(api.listarPedidosQuitacao).mockResolvedValue([
      {
        id: 'p1',
        associadoId: 'a1',
        razaoSocial: 'Farmácia Exemplo Ltda',
        solicitadoEm: '2026-11-20T12:00:00.000Z',
        meses: [],
        total: '250.00',
      },
    ]);
    abrir();

    expect(
      await screen.findByRole('heading', {
        name: '1 pedido do boleto dos meses em aberto espera resposta',
      }),
    ).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Farmácia Exemplo Ltda' }),
    ).toHaveAttribute('href', '/admin/associados/a1');
  });

  it('o chave mestre vê quantos pedidos de cancelamento esperam resposta (RF27)', async () => {
    vi.mocked(api.listarAssociados).mockResolvedValue(lista(2));
    abrir();

    expect(
      await screen.findByRole('heading', {
        name: '2 pedidos de cancelamento esperam resposta',
      }),
    ).toBeInTheDocument();
    expect(api.listarAssociados).toHaveBeenCalledWith({
      status: 'CANCELAMENTO_SOLICITADO',
    });
    expect(
      screen.getByRole('link', { name: 'Ver os pedidos' }),
    ).toHaveAttribute(
      'href',
      '/admin/associados?status=CANCELAMENTO_SOLICITADO',
    );
  });

  it('sem pedido pendente, não mostra o aviso', async () => {
    vi.mocked(api.listarAssociados).mockResolvedValue(lista(0));
    abrir();

    expect(await screen.findByText('Em construção.')).toBeInTheDocument();
    await vi.waitFor(() => expect(api.listarAssociados).toHaveBeenCalled());
    expect(
      screen.queryByRole('link', { name: 'Ver os pedidos' }),
    ).not.toBeInTheDocument();
  });

  it('o perfil básico, que não decide, não vê o aviso (RN33)', () => {
    entrarComo('ADMIN_BASICO');
    abrir();

    expect(api.listarAssociados).not.toHaveBeenCalled();
  });

  it('avisa quando não consegue conferir os pedidos', async () => {
    vi.mocked(api.listarAssociados).mockRejectedValue(new Error('falhou'));
    abrir();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível conferir os pedidos de cancelamento agora.',
    );
  });
});
