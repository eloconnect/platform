import type { ApiClient } from '@eloconnect/shared';
import { ApiError, TERMO_ADESAO } from '@eloconnect/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../api';
import { lerAviso } from '../../componentes';
import { PaginaAdesaoAssociado } from './PaginaAdesaoAssociado';

vi.mock('../../api', () => ({
  api: {
    situacaoAdesao: vi.fn<ApiClient['situacaoAdesao']>(),
    aderir: vi.fn<ApiClient['aderir']>(),
  },
}));

/** No lugar de "Meus boletos": mostra o aviso que a adesão deixou. */
function DestinoBoletos() {
  return <p>Destino: {lerAviso(useLocation().state)}</p>;
}

function abrir() {
  render(
    <MemoryRouter initialEntries={['/associado/adesao']}>
      <Routes>
        <Route path="/associado/adesao" element={<PaginaAdesaoAssociado />} />
        <Route path="/associado/boletos" element={<DestinoBoletos />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PaginaAdesaoAssociado', () => {
  beforeEach(() => {
    vi.mocked(api.situacaoAdesao).mockResolvedValue({
      recebeBoletoMensal: false,
      valorMensal: '120.00',
    });
    vi.mocked(api.aderir).mockReset();
  });

  it('mostra o valor e o termo, e só adere depois do aceite (RN23)', async () => {
    vi.mocked(api.aderir).mockResolvedValue({ boletoGerado: true });
    abrir();

    expect(await screen.findByText(/Valor: R\$\s120,00 por mês/)).toBeVisible();
    expect(
      screen.getByRole('heading', { name: 'Termo de adesão' }),
    ).toBeInTheDocument();
    for (const paragrafo of TERMO_ADESAO.paragrafos) {
      expect(screen.getByText(paragrafo)).toBeInTheDocument();
    }

    const aderir = screen.getByRole('button', {
      name: 'Quero receber o boleto todo mês',
    });
    await userEvent.click(aderir);
    expect(
      screen.getByText('Para aderir, marque que leu e aceita o termo.'),
    ).toBeVisible();
    expect(api.aderir).not.toHaveBeenCalled();

    await userEvent.click(
      screen.getByLabelText('Li e aceito o termo de adesão'),
    );
    await userEvent.click(aderir);

    expect(api.aderir).toHaveBeenCalledWith({
      versaoTermo: TERMO_ADESAO.versao,
    });
    expect(
      await screen.findByText(
        'Destino: Pronto! A partir de agora, a farmácia recebe o boleto todo mês. O boleto deste mês está aqui e também vai por e-mail.',
      ),
    ).toBeInTheDocument();
  });

  it('mostra a mensagem da API quando a adesão é recusada', async () => {
    vi.mocked(api.aderir).mockRejectedValue(
      new ApiError(409, 'A farmácia já recebe o boleto todo mês.'),
    );
    abrir();

    await userEvent.click(
      await screen.findByLabelText('Li e aceito o termo de adesão'),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Quero receber o boleto todo mês' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A farmácia já recebe o boleto todo mês.',
    );
  });

  it('quem já recebe o boleto vê o link para os boletos', async () => {
    vi.mocked(api.situacaoAdesao).mockResolvedValue({
      recebeBoletoMensal: true,
      valorMensal: '120.00',
    });
    abrir();

    expect(
      await screen.findByText('A farmácia já recebe o boleto todo mês.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Ver meus boletos' }),
    ).toHaveAttribute('href', '/associado/boletos');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('sem o valor cadastrado pela sede, a adesão não aparece', async () => {
    vi.mocked(api.situacaoAdesao).mockResolvedValue({
      recebeBoletoMensal: false,
      valorMensal: null,
    });
    abrir();

    expect(
      await screen.findByText(
        'A adesão ainda não está disponível. Fale com a sede do sindicato.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
