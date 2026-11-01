import type { ApiClient, BoletoEmAberto } from '@eloconnect/shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../api';
import { PaginaBoletosAssociado } from './PaginaBoletosAssociado';

vi.mock('../../api', () => ({
  api: {
    listarMeusBoletos: vi.fn<ApiClient['listarMeusBoletos']>(),
    baixarPdfMeuBoleto: vi.fn<ApiClient['baixarPdfMeuBoleto']>(),
  },
}));

const DEZEMBRO: BoletoEmAberto = {
  id: 'boleto-12',
  competencia: { ano: 2026, mes: 12 },
  valor: '130.00',
  vencimento: '2026-12-10',
  validoAte: '2027-01-09',
  vencido: false,
  linhaDigitavel: '74891.00000 00000.000001 230000.000000 0 00000000013000',
  pixCopiaECola: '00020101-pix-simulado-SIM000000000123',
};

const NOVEMBRO: BoletoEmAberto = {
  ...DEZEMBRO,
  id: 'boleto-11',
  competencia: { ano: 2026, mes: 11 },
  vencimento: '2026-11-10',
  validoAte: '2026-12-10',
  vencido: true,
};

describe('PaginaBoletosAssociado', () => {
  beforeEach(() => {
    vi.mocked(api.listarMeusBoletos).mockResolvedValue([NOVEMBRO, DEZEMBRO]);
    vi.mocked(api.baixarPdfMeuBoleto).mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('mostra cada boleto com valor, vencimento, situação, QR Code e códigos', async () => {
    render(<PaginaBoletosAssociado />);

    const [novembro, dezembro] = await screen.findAllByRole('article');
    expect(
      within(dezembro).getByRole('heading', {
        level: 2,
        name: 'Boleto de dezembro de 2026',
      }),
    ).toBeInTheDocument();
    expect(dezembro).toHaveTextContent(/Valor: R\$\s130,00/);
    expect(dezembro).toHaveTextContent('Vencimento: 10/12/2026');
    expect(dezembro).toHaveTextContent('Situação: em aberto.');
    expect(within(dezembro).getByAltText('QR Code do Pix')).toHaveAttribute(
      'src',
      expect.stringMatching(/^data:image\/svg\+xml/),
    );
    expect(dezembro).toHaveTextContent(DEZEMBRO.pixCopiaECola);
    expect(dezembro).toHaveTextContent(DEZEMBRO.linhaDigitavel);

    // O vencido diz até quando ainda dá para pagar (RN03, RN09).
    expect(novembro).toHaveTextContent(
      'Situação: vencido. Você ainda pode pagar até 10/12/2026.',
    );
  });

  it('copia o código Pix e a linha digitável', async () => {
    const usuario = userEvent.setup();
    vi.mocked(api.listarMeusBoletos).mockResolvedValue([DEZEMBRO]);
    render(<PaginaBoletosAssociado />);

    await usuario.click(
      await screen.findByRole('button', { name: 'Copiar o código Pix' }),
    );
    expect(await navigator.clipboard.readText()).toBe(DEZEMBRO.pixCopiaECola);
    expect(screen.getByRole('status')).toHaveTextContent('Código Pix copiado.');

    await usuario.click(
      screen.getByRole('button', { name: 'Copiar a linha digitável' }),
    );
    expect(await navigator.clipboard.readText()).toBe(DEZEMBRO.linhaDigitavel);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Linha digitável copiada.',
    );
  });

  it('avisa quando o navegador não deixa copiar', async () => {
    const usuario = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(
      new Error('Sem permissão'),
    );
    vi.mocked(api.listarMeusBoletos).mockResolvedValue([DEZEMBRO]);
    render(<PaginaBoletosAssociado />);

    await usuario.click(
      await screen.findByRole('button', { name: 'Copiar o código Pix' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível copiar.',
    );
  });

  it('baixa o PDF do boleto', async () => {
    const pdf = new Blob(['%PDF-'], { type: 'application/pdf' });
    vi.mocked(api.baixarPdfMeuBoleto).mockResolvedValue(pdf);
    vi.mocked(api.listarMeusBoletos).mockResolvedValue([DEZEMBRO]);
    const criarEndereco = vi.fn<typeof URL.createObjectURL>(() => 'blob:pdf');
    vi.stubGlobal('URL', {
      createObjectURL: criarEndereco,
      revokeObjectURL: vi.fn<typeof URL.revokeObjectURL>(),
    });
    const abrirJanela = vi.fn<typeof window.open>(() => window);
    vi.stubGlobal('open', abrirJanela);
    render(<PaginaBoletosAssociado />);

    await userEvent.click(
      await screen.findByRole('button', { name: 'Baixar o PDF do boleto' }),
    );

    expect(api.baixarPdfMeuBoleto).toHaveBeenCalledWith('boleto-12');
    expect(criarEndereco).toHaveBeenCalledWith(pdf);
    expect(abrirJanela).toHaveBeenCalledWith('blob:pdf', '_blank');
  });

  it('avisa quando não consegue baixar o PDF', async () => {
    vi.mocked(api.baixarPdfMeuBoleto).mockRejectedValue(
      new TypeError('Failed to fetch'),
    );
    vi.mocked(api.listarMeusBoletos).mockResolvedValue([DEZEMBRO]);
    render(<PaginaBoletosAssociado />);

    await userEvent.click(
      await screen.findByRole('button', { name: 'Baixar o PDF do boleto' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível baixar o PDF agora.',
    );
  });

  it('avisa quando não há boleto em aberto', async () => {
    vi.mocked(api.listarMeusBoletos).mockResolvedValue([]);
    render(<PaginaBoletosAssociado />);

    expect(
      await screen.findByText('Você não tem boleto em aberto.'),
    ).toBeInTheDocument();
  });

  it('avisa quando não consegue carregar os boletos', async () => {
    vi.mocked(api.listarMeusBoletos).mockRejectedValue(
      new TypeError('Failed to fetch'),
    );
    render(<PaginaBoletosAssociado />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar os boletos agora.',
    );
  });
});
