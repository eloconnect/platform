import type { ApiClient } from '@eloconnect/shared';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../api';
import { entrarComo } from '../../test/sessao';
import { PaginaInicioAdmin } from './PaginaInicioAdmin';

vi.mock('../../api', () => ({
  api: { listarAssociados: vi.fn<ApiClient['listarAssociados']>() },
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
