import type { ApiClient, BeneficiosAssociado } from '@eloconnect/shared';
import { ApiError } from '@eloconnect/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../api';
import { PaginaBeneficiosAssociado } from './PaginaBeneficiosAssociado';

vi.mock('../../api', () => ({
  api: {
    meusBeneficios: vi.fn<ApiClient['meusBeneficios']>(),
    enviarSuporte: vi.fn<ApiClient['enviarSuporte']>(),
  },
}));

const DADOS: BeneficiosAssociado = {
  beneficios: [
    {
      id: 'b1',
      titulo: 'Orientação trabalhista',
      descricao: 'Dúvidas do dia a dia.',
      grupo: 'CONSULTORIA',
    },
    {
      id: 'b2',
      titulo: 'Defesa em processo',
      descricao: 'Advogado em tribunal.',
      grupo: 'ASSESSORIA_JURIDICA',
    },
  ],
  consultoriaLiberada: true,
  juridicaLiberada: false,
};

function abrir() {
  render(
    <MemoryRouter>
      <PaginaBeneficiosAssociado />
    </MemoryRouter>,
  );
}

describe('PaginaBeneficiosAssociado', () => {
  beforeEach(() => {
    vi.mocked(api.meusBeneficios).mockResolvedValue(DADOS);
    vi.mocked(api.enviarSuporte).mockReset();
  });

  it('mostra cada grupo e o que está liberado (RN32)', async () => {
    abrir();

    expect(await screen.findByText('Orientação trabalhista')).toBeVisible();
    expect(screen.getByText('Defesa em processo')).toBeVisible();
    expect(screen.getByText('Liberado para a sua farmácia.')).toBeVisible();
    expect(screen.getByText(/Disponível com o plano anual pago/)).toBeVisible();
  });

  it('em dia, envia o pedido de suporte (RF25)', async () => {
    vi.mocked(api.enviarSuporte).mockResolvedValue({
      enviadoEm: '2026-11-25T12:00:00.000Z',
    });
    abrir();

    await userEvent.click(
      await screen.findByRole('button', { name: 'Enviar o pedido' }),
    );
    expect(screen.getByText('Informe o assunto.')).toBeVisible();
    expect(api.enviarSuporte).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText(/Assunto/), 'Férias');
    await userEvent.type(screen.getByLabelText(/Mensagem/), 'Como calcular?');
    await userEvent.click(
      screen.getByRole('button', { name: 'Enviar o pedido' }),
    );

    expect(api.enviarSuporte).toHaveBeenCalledWith({
      assunto: 'Férias',
      mensagem: 'Como calcular?',
    });
    expect(await screen.findByText(/Pedido enviado/)).toBeVisible();
  });

  it('quem não está em dia não vê o formulário', async () => {
    vi.mocked(api.meusBeneficios).mockResolvedValue({
      ...DADOS,
      consultoriaLiberada: false,
    });
    abrir();

    expect(
      await screen.findByText(
        'O suporte é para quem está com a contribuição em dia.',
      ),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Enviar o pedido' }),
    ).not.toBeInTheDocument();
  });

  it('avisa quando a API recusa o pedido', async () => {
    vi.mocked(api.enviarSuporte).mockRejectedValue(new ApiError(403, 'x'));
    abrir();

    await userEvent.type(await screen.findByLabelText(/Assunto/), 'A');
    await userEvent.type(screen.getByLabelText(/Mensagem/), 'B');
    await userEvent.click(
      screen.getByRole('button', { name: 'Enviar o pedido' }),
    );

    expect(
      await screen.findByText(
        'O suporte é para quem está com a contribuição em dia.',
      ),
    ).toBeVisible();
  });
});
