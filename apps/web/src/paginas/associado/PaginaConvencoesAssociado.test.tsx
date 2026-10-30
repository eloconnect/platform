import type { ApiClient, Convencao } from '@eloconnect/shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../api';
import { PaginaConvencoesAssociado } from './PaginaConvencoesAssociado';

vi.mock('../../api', () => ({
  api: {
    listarConvencoesAssociado: vi.fn<ApiClient['listarConvencoesAssociado']>(),
    baixarPdfConvencaoAssociado:
      vi.fn<ApiClient['baixarPdfConvencaoAssociado']>(),
  },
}));

const COM_PDF: Convencao = {
  id: 'convencao-01',
  titulo: 'Convenção Coletiva 2026',
  ano: 2026,
  resumo: 'O que mudou: piso novo.\nO resto continua igual.',
  publicadaEm: '2026-10-01T15:00:00.000Z',
  criadoEm: '2026-10-01T12:00:00.000Z',
  atualizadoEm: '2026-10-01T15:00:00.000Z',
  anexos: [
    {
      id: 'anexo-01',
      tipo: 'INTEGRAL',
      nomeArquivo: 'convencao-integral.pdf',
      tamanhoBytes: 1024,
    },
    {
      id: 'anexo-02',
      tipo: 'RESUMIDA',
      nomeArquivo: 'convencao-resumida.pdf',
      tamanhoBytes: 512,
    },
  ],
};

const SEM_PDF: Convencao = {
  ...COM_PDF,
  id: 'convencao-02',
  titulo: 'Convenção Coletiva 2025',
  ano: 2025,
  anexos: [],
};

describe('PaginaConvencoesAssociado', () => {
  beforeEach(() => {
    vi.mocked(api.listarConvencoesAssociado).mockResolvedValue([
      COM_PDF,
      SEM_PDF,
    ]);
    vi.mocked(api.baixarPdfConvencaoAssociado).mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('mostra cada convenção com o resumo em destaque', async () => {
    render(<PaginaConvencoesAssociado />);

    const [primeira, segunda] = await screen.findAllByRole('article');
    expect(
      within(primeira).getByRole('heading', {
        level: 2,
        name: 'Convenção Coletiva 2026',
      }),
    ).toBeInTheDocument();
    expect(primeira).toHaveTextContent('Ano: 2026');
    expect(within(primeira).getByText(/O que mudou: piso novo\./)).toHaveClass(
      'texto-com-quebras',
      'fs-5',
    );
    expect(
      within(segunda).getByText(
        'O PDF desta convenção ainda não está disponível.',
      ),
    ).toBeInTheDocument();
    expect(within(segunda).queryByRole('button')).not.toBeInTheDocument();
  });

  it('abre o PDF que a API entrega numa aba nova', async () => {
    const pdf = new Blob(['%PDF-'], { type: 'application/pdf' });
    vi.mocked(api.baixarPdfConvencaoAssociado).mockResolvedValue(pdf);
    const criarEndereco = vi.fn<typeof URL.createObjectURL>(() => 'blob:pdf');
    vi.stubGlobal('URL', {
      createObjectURL: criarEndereco,
      revokeObjectURL: vi.fn<typeof URL.revokeObjectURL>(),
    });
    const abrirJanela = vi.fn<typeof window.open>(() => window);
    vi.stubGlobal('open', abrirJanela);
    render(<PaginaConvencoesAssociado />);

    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Abrir o PDF: Convenção Coletiva 2026',
      }),
    );

    expect(api.baixarPdfConvencaoAssociado).toHaveBeenCalledWith(
      'convencao-01',
    );
    expect(criarEndereco).toHaveBeenCalledWith(pdf);
    expect(abrirJanela).toHaveBeenCalledWith('blob:pdf', '_blank');
  });

  it('avisa quando não consegue abrir o PDF', async () => {
    vi.mocked(api.baixarPdfConvencaoAssociado).mockRejectedValue(
      new TypeError('Failed to fetch'),
    );
    render(<PaginaConvencoesAssociado />);

    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Abrir o PDF: Convenção Coletiva 2026',
      }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível abrir o PDF agora.',
    );
  });

  it('avisa quando ainda não há convenções', async () => {
    vi.mocked(api.listarConvencoesAssociado).mockResolvedValue([]);
    render(<PaginaConvencoesAssociado />);

    expect(
      await screen.findByText('Ainda não há convenções publicadas.'),
    ).toBeInTheDocument();
  });

  it('avisa quando não consegue carregar', async () => {
    vi.mocked(api.listarConvencoesAssociado).mockRejectedValue(
      new TypeError('Failed to fetch'),
    );
    render(<PaginaConvencoesAssociado />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar as convenções agora.',
    );
  });
});
