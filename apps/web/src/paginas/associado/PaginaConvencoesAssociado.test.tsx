import type { ApiClient, Convencao, MinhaConta } from '@eloconnect/shared';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../api';
import { PaginaConvencoesAssociado } from './PaginaConvencoesAssociado';

vi.mock('../../api', () => ({
  api: {
    listarConvencoesAssociado: vi.fn<ApiClient['listarConvencoesAssociado']>(),
    minhaConta: vi.fn<ApiClient['minhaConta']>(),
    baixarAnexoConvencaoAssociado:
      vi.fn<ApiClient['baixarAnexoConvencaoAssociado']>(),
  },
}));

const CONVENCOES: Convencao[] = [
  {
    id: 'convencao-01',
    titulo: 'Convenção coletiva de exemplo',
    ano: 2026,
    resumo: 'Resumo fictício da convenção coletiva.',
    publicadaEm: '2026-10-01T12:00:00.000Z',
    criadoEm: '2026-09-20T12:00:00.000Z',
    atualizadoEm: '2026-10-01T12:00:00.000Z',
    anexos: [
      {
        id: 'anexo-resumido',
        tipo: 'RESUMIDA',
        nomeArquivo: 'resumo.pdf',
        tamanhoBytes: 1024,
      },
      {
        id: 'anexo-integral',
        tipo: 'INTEGRAL',
        nomeArquivo: 'integral.pdf',
        tamanhoBytes: 2048,
      },
    ],
  },
  {
    id: 'convencao-02',
    titulo: 'Convenção ainda não publicada',
    ano: 2025,
    resumo: 'Conteúdo que não deve aparecer.',
    publicadaEm: null,
    criadoEm: '2025-09-20T12:00:00.000Z',
    atualizadoEm: '2025-09-20T12:00:00.000Z',
    anexos: [],
  },
];

const CONTA_ADIMPLENTE: MinhaConta = {
  nome: 'Drogaria Exemplo',
  situacao: 'Adimplente',
  situacaoAcesso: 'ADIMPLENTE',
  contribuicaoAtiva: true,
  acessoLiberadoAte: null,
};

const CONTA_ADIMPLENTE_SEM_CONTRIBUICAO: MinhaConta = {
  nome: 'Drogaria Exemplo',
  situacao: 'Sem contribuição ativa',
  situacaoAcesso: 'ADIMPLENTE',
  contribuicaoAtiva: false,
  acessoLiberadoAte: null,
};

const CONTA_INADIMPLENTE: MinhaConta = {
  nome: 'Drogaria Exemplo',
  situacao: 'Inadimplente',
  situacaoAcesso: 'INADIMPLENTE',
  contribuicaoAtiva: true,
  acessoLiberadoAte: null,
};

const CONTA_INADIMPLENTE_COM_LIBERACAO: MinhaConta = {
  nome: 'Drogaria Exemplo',
  situacao: 'Inadimplente',
  situacaoAcesso: 'INADIMPLENTE',
  contribuicaoAtiva: true,
  acessoLiberadoAte: '2026-11-04T12:00:00.000Z',
};

describe('PaginaConvencoesAssociado', () => {
  beforeEach(() => {
    vi.mocked(api.listarConvencoesAssociado).mockReset();
    vi.mocked(api.minhaConta).mockReset();
    vi.mocked(api.baixarAnexoConvencaoAssociado).mockReset();

    vi.mocked(api.listarConvencoesAssociado).mockResolvedValue(CONVENCOES);
    vi.mocked(api.minhaConta).mockResolvedValue(CONTA_ADIMPLENTE);
    vi.mocked(api.baixarAnexoConvencaoAssociado).mockResolvedValue(
      new Blob(['PDF fictício'], { type: 'application/pdf' }),
    );
  });

  it('mostra as convenções publicadas e oculta as não publicadas', async () => {
    render(<PaginaConvencoesAssociado />);

    expect(
      await screen.findByRole('heading', {
        name: 'Convenção coletiva de exemplo',
      }),
    ).toBeInTheDocument();

    expect(
      screen.queryByText('Convenção ainda não publicada'),
    ).not.toBeInTheDocument();

    expect(
      screen.getByText('Resumo fictício da convenção coletiva.'),
    ).toBeInTheDocument();
  });

  it('mostra os PDFs resumido e integral para associado adimplente com contribuição ativa', async () => {
    render(<PaginaConvencoesAssociado />);

    expect(
      await screen.findByRole('button', {
        name: 'Baixar PDF resumido',
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('button', {
        name: 'Baixar PDF integral',
      }),
    ).toBeInTheDocument();
  });

  it('permite o PDF resumido, mas não o integral para adimplente sem contribuição ativa', async () => {
    vi.mocked(api.minhaConta).mockResolvedValue(
      CONTA_ADIMPLENTE_SEM_CONTRIBUICAO,
    );

    render(<PaginaConvencoesAssociado />);

    expect(
      await screen.findByRole('button', {
        name: 'Baixar PDF resumido',
      }),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole('button', {
        name: 'Baixar PDF integral',
      }),
    ).not.toBeInTheDocument();
  });

  it('permite consultar informações e baixar o resumo para inadimplente', async () => {
    vi.mocked(api.minhaConta).mockResolvedValue(CONTA_INADIMPLENTE);

    render(<PaginaConvencoesAssociado />);

    expect(
      await screen.findByRole('heading', {
        name: 'Convenção coletiva de exemplo',
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('button', {
        name: 'Baixar PDF resumido',
      }),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole('button', {
        name: 'Baixar PDF integral',
      }),
    ).not.toBeInTheDocument();
  });

  it('não libera o PDF integral para inadimplente com liberação manual (RN11)', async () => {
    vi.mocked(api.minhaConta).mockResolvedValue(
      CONTA_INADIMPLENTE_COM_LIBERACAO,
    );

    render(<PaginaConvencoesAssociado />);

    expect(
      await screen.findByRole('button', {
        name: 'Baixar PDF resumido',
      }),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole('button', {
        name: 'Baixar PDF integral',
      }),
    ).not.toBeInTheDocument();
  });

  it('avisa quando não existem convenções publicadas', async () => {
    vi.mocked(api.listarConvencoesAssociado).mockResolvedValue([]);

    render(<PaginaConvencoesAssociado />);

    expect(
      await screen.findByText('Não há convenções publicadas no momento.'),
    ).toBeInTheDocument();
  });

  it('avisa quando não consegue carregar as convenções', async () => {
    vi.mocked(api.listarConvencoesAssociado).mockRejectedValue(
      new TypeError('Failed to fetch'),
    );

    render(<PaginaConvencoesAssociado />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar as convenções agora.',
    );
  });

  it('permite tentar novamente depois de um erro', async () => {
    vi.mocked(api.listarConvencoesAssociado)
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(CONVENCOES);

    render(<PaginaConvencoesAssociado />);

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Tentar novamente',
      }),
    );

    expect(
      await screen.findByRole('heading', {
        name: 'Convenção coletiva de exemplo',
      }),
    ).toBeInTheDocument();

    expect(api.listarConvencoesAssociado).toHaveBeenCalledTimes(2);
  });

  it('solicita o PDF resumido à API ao clicar no botão', async () => {
    const createObjectURL = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:http://localhost/pdf');

    const open = vi.spyOn(window, 'open').mockReturnValue({} as Window);

    render(<PaginaConvencoesAssociado />);

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Baixar PDF resumido',
      }),
    );

    await waitFor(() => {
      expect(api.baixarAnexoConvencaoAssociado).toHaveBeenCalledWith(
        'convencao-01',
        'RESUMIDA',
      );
    });

    expect(createObjectURL).toHaveBeenCalled();
    expect(open).toHaveBeenCalledWith('blob:http://localhost/pdf', '_blank');

    createObjectURL.mockRestore();
    open.mockRestore();
  });

  it('solicita o PDF integral à API para associado elegível', async () => {
    const createObjectURL = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:http://localhost/pdf');

    const open = vi.spyOn(window, 'open').mockReturnValue({} as Window);

    render(<PaginaConvencoesAssociado />);

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Baixar PDF integral',
      }),
    );

    await waitFor(() => {
      expect(api.baixarAnexoConvencaoAssociado).toHaveBeenCalledWith(
        'convencao-01',
        'INTEGRAL',
      );
    });

    createObjectURL.mockRestore();
    open.mockRestore();
  });

  it('avisa quando não consegue baixar um documento', async () => {
    vi.mocked(api.baixarAnexoConvencaoAssociado).mockRejectedValue(
      new Error('Erro no download'),
    );

    render(<PaginaConvencoesAssociado />);

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Baixar PDF resumido',
      }),
    );

    expect(
      await screen.findByText(
        'Não foi possível abrir o documento. Tente novamente.',
      ),
    ).toBeInTheDocument();
  });
});
