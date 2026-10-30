import type { ApiClient, Convencao } from '@eloconnect/shared';
import { ApiError } from '@eloconnect/shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../api';
import { entrarComo } from '../../test/sessao';
import { PaginaConvencoes } from './PaginaConvencoes';

vi.mock('../../api', () => ({
  api: {
    listarConvencoes: vi.fn<ApiClient['listarConvencoes']>(),
    criarConvencao: vi.fn<ApiClient['criarConvencao']>(),
    editarConvencao: vi.fn<ApiClient['editarConvencao']>(),
    atualizarAnexosConvencao: vi.fn<ApiClient['atualizarAnexosConvencao']>(),
    publicarConvencao: vi.fn<ApiClient['publicarConvencao']>(),
    baixarAnexoConvencao: vi.fn<ApiClient['baixarAnexoConvencao']>(),
  },
}));

const CONVENCAO: Convencao = {
  id: 'convencao-01',
  titulo: 'Convenção coletiva de teste',
  ano: 2026,
  resumo: 'Resumo fictício da convenção.',
  publicadaEm: null,
  criadoEm: '2026-01-01T12:00:00.000Z',
  atualizadoEm: '2026-01-01T12:00:00.000Z',
  anexos: [
    {
      id: 'anexo-01',
      tipo: 'INTEGRAL',
      nomeArquivo: 'integral.pdf',
      tamanhoBytes: 1024,
    },
    {
      id: 'anexo-02',
      tipo: 'RESUMIDA',
      nomeArquivo: 'resumida.pdf',
      tamanhoBytes: 512,
    },
  ],
};

async function abrir() {
  render(<PaginaConvencoes />);
  await screen.findByRole('button', { name: 'Cadastrar convenção' });
}

describe('PaginaConvencoes', () => {
  beforeEach(() => {
    entrarComo('ADMIN_BASICO');

    vi.mocked(api.listarConvencoes).mockReset();
    vi.mocked(api.criarConvencao).mockReset();
    vi.mocked(api.editarConvencao).mockReset();
    vi.mocked(api.atualizarAnexosConvencao).mockReset();
    vi.mocked(api.publicarConvencao).mockReset();

    vi.mocked(api.listarConvencoes).mockResolvedValue([CONVENCAO]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('mostra a convenção e sua situação', async () => {
    await abrir();

    expect(
      screen.getByRole('heading', {
        name: 'Convenção coletiva de teste',
      }),
    ).toBeInTheDocument();

    expect(screen.getByText('Rascunho')).toBeInTheDocument();
    expect(screen.getByText(/Integral, Resumido/)).toBeInTheDocument();
  });

  it('cadastra uma convenção', async () => {
    const user = userEvent.setup();

    const nova: Convencao = {
      ...CONVENCAO,
      id: 'convencao-02',
      titulo: 'Convenção nova',
      resumo: 'Resumo novo.',
      anexos: [],
    };

    vi.mocked(api.criarConvencao).mockResolvedValue(nova);

    await abrir();

    await user.click(
      screen.getByRole('button', { name: 'Cadastrar convenção' }),
    );

    const janela = screen.getByRole('dialog', {
      name: 'Cadastrar convenção',
    });

    await user.type(
      within(janela).getByLabelText(/Título da convenção/),
      'Convenção nova',
    );

    await user.clear(within(janela).getByLabelText('Ano'));
    await user.type(within(janela).getByLabelText('Ano'), '2026');

    await user.type(within(janela).getByLabelText(/Resumo/), 'Resumo novo.');

    await user.click(within(janela).getByRole('button', { name: 'Salvar' }));

    expect(api.criarConvencao).toHaveBeenCalledWith({
      titulo: 'Convenção nova',
      ano: 2026,
      resumo: 'Resumo novo.',
    });

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Convenção cadastrada.',
    );

    expect(
      screen.getByRole('heading', { name: 'Convenção nova' }),
    ).toBeInTheDocument();
  });

  it('edita os dados da convenção', async () => {
    const user = userEvent.setup();

    vi.mocked(api.editarConvencao).mockResolvedValue({
      ...CONVENCAO,
      titulo: 'Convenção atualizada',
    });

    await abrir();

    await user.click(screen.getByRole('button', { name: 'Editar' }));

    const janela = screen.getByRole('dialog', {
      name: 'Editar convenção',
    });

    const titulo = within(janela).getByLabelText(/Título da convenção/);

    expect(titulo).toHaveValue('Convenção coletiva de teste');

    await user.clear(titulo);
    await user.type(titulo, 'Convenção atualizada');

    await user.click(within(janela).getByRole('button', { name: 'Salvar' }));

    expect(api.editarConvencao).toHaveBeenCalledWith(
      'convencao-01',
      expect.objectContaining({
        titulo: 'Convenção atualizada',
        ano: 2026,
        resumo: 'Resumo fictício da convenção.',
      }),
    );

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Convenção alterada.',
    );
  });

  it('envia os PDFs selecionados', async () => {
    const user = userEvent.setup();

    vi.mocked(api.atualizarAnexosConvencao).mockResolvedValue(CONVENCAO);

    await abrir();

    await user.click(screen.getByRole('button', { name: 'Enviar PDFs' }));

    const janela = screen.getByRole('dialog', {
      name: 'Enviar PDFs',
    });

    const integral = new File(
      ['%PDF-1.4\nConteúdo fictício do documento integral'],
      'integral.pdf',
      { type: 'application/pdf' },
    );

    const resumida = new File(
      ['%PDF-1.4\nConteúdo fictício do documento resumido'],
      'resumida.pdf',
      { type: 'application/pdf' },
    );

    await user.upload(
      within(janela).getByLabelText(/Convenção integral \(PDF\)/i),
      integral,
    );

    await user.upload(
      within(janela).getByLabelText(/Convenção resumida \(PDF\)/i),
      resumida,
    );

    await user.click(
      within(janela).getByRole('button', { name: 'Enviar documentos' }),
    );

    expect(api.atualizarAnexosConvencao).toHaveBeenCalledWith(
      'convencao-01',
      expect.any(FormData),
    );

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Documentos enviados.',
    );
  });

  it('avisa na janela quando não consegue salvar e quando falta o resumo', async () => {
    const user = userEvent.setup();

    vi.mocked(api.criarConvencao).mockRejectedValue(
      new TypeError('Failed to fetch'),
    );

    await abrir();

    await user.click(
      screen.getByRole('button', { name: 'Cadastrar convenção' }),
    );

    const janela = screen.getByRole('dialog', {
      name: 'Cadastrar convenção',
    });

    await user.type(
      within(janela).getByLabelText(/Título da convenção/),
      'Convenção nova',
    );
    await user.click(within(janela).getByRole('button', { name: 'Salvar' }));

    expect(within(janela).getByText('Informe o resumo.')).toBeInTheDocument();
    expect(api.criarConvencao).not.toHaveBeenCalled();

    await user.type(within(janela).getByLabelText(/Resumo/), 'Resumo novo.');
    await user.click(within(janela).getByRole('button', { name: 'Salvar' }));

    expect(await within(janela).findByRole('alert')).toHaveTextContent(
      'Não foi possível concluir a operação.',
    );
  });

  it('explica o que falta no envio dos PDFs', async () => {
    const user = userEvent.setup();
    const pdf = (nome: string, tamanho = 10) =>
      new File(['%PDF-'.padEnd(tamanho, ' ')], nome, {
        type: 'application/pdf',
      });

    vi.mocked(api.listarConvencoes).mockResolvedValue([
      { ...CONVENCAO, anexos: [] },
    ]);
    vi.mocked(api.atualizarAnexosConvencao).mockRejectedValue(
      new ApiError(413, 'grande demais'),
    );

    await abrir();

    await user.click(screen.getByRole('button', { name: 'Enviar PDFs' }));

    const janela = screen.getByRole('dialog', { name: 'Enviar PDFs' });
    const enviar = within(janela).getByRole('button', {
      name: 'Enviar documentos',
    });

    await user.click(enviar);
    expect(within(janela).getByRole('alert')).toHaveTextContent(
      'Escolha pelo menos um PDF.',
    );

    await user.upload(
      within(janela).getByLabelText(/Convenção resumida \(PDF\)/i),
      pdf('resumida.pdf'),
    );
    await user.click(enviar);
    expect(within(janela).getByRole('alert')).toHaveTextContent(
      'Na primeira vez, envie os dois PDFs: o integral e o resumido.',
    );

    await user.upload(
      within(janela).getByLabelText(/Convenção integral \(PDF\)/i),
      pdf('integral.pdf'),
    );
    await user.click(enviar);
    expect(await within(janela).findByRole('alert')).toHaveTextContent(
      'Cada PDF pode ter até 4 MB.',
    );
  });

  it('publica a convenção', async () => {
    const user = userEvent.setup();

    vi.mocked(api.publicarConvencao).mockResolvedValue({
      ...CONVENCAO,
      publicadaEm: '2026-02-01T12:00:00.000Z',
    });

    await abrir();

    await user.click(screen.getByRole('button', { name: 'Publicar' }));

    expect(api.publicarConvencao).toHaveBeenCalledWith('convencao-01');

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Convenção publicada.',
    );

    expect(screen.getByText('Publicada')).toBeInTheDocument();
  });

  it('não deixa publicar sem os dois PDFs', async () => {
    vi.mocked(api.listarConvencoes).mockResolvedValue([
      { ...CONVENCAO, anexos: [CONVENCAO.anexos[1]] },
    ]);

    await abrir();

    expect(screen.getByRole('button', { name: 'Publicar' })).toBeDisabled();
    expect(
      screen.getByText(
        'Para publicar, envie os dois PDFs: o integral e o resumido.',
      ),
    ).toBeInTheDocument();
  });

  it('avisa quando não consegue publicar', async () => {
    const user = userEvent.setup();

    vi.mocked(api.publicarConvencao).mockRejectedValue(
      new TypeError('Failed to fetch'),
    );

    await abrir();

    await user.click(screen.getByRole('button', { name: 'Publicar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível publicar a convenção.',
    );
  });

  it('mostra como o associado vê a convenção', async () => {
    const user = userEvent.setup();

    await abrir();

    await user.click(
      screen.getByRole('button', { name: 'Ver como o associado vê' }),
    );

    const janela = screen.getByRole('dialog', { name: 'Como o associado vê' });
    expect(
      within(janela).getByRole('heading', {
        level: 3,
        name: 'Convenção coletiva de teste',
      }),
    ).toBeInTheDocument();
    expect(
      within(janela).getByText('Resumo fictício da convenção.'),
    ).toHaveClass('texto-com-quebras');
  });

  it('abre o PDF numa aba nova', async () => {
    const user = userEvent.setup();
    const arquivo = new Blob(['%PDF-'], { type: 'application/pdf' });
    vi.mocked(api.baixarAnexoConvencao).mockResolvedValue(arquivo);
    const criarEndereco = vi.fn<typeof URL.createObjectURL>(() => 'blob:pdf');
    vi.stubGlobal('URL', {
      createObjectURL: criarEndereco,
      revokeObjectURL: vi.fn<typeof URL.revokeObjectURL>(),
    });
    const abrirJanela = vi.fn<typeof window.open>(() => window);
    vi.stubGlobal('open', abrirJanela);

    await abrir();

    await user.click(
      screen.getByRole('button', { name: 'Abrir PDF resumido' }),
    );

    expect(api.baixarAnexoConvencao).toHaveBeenCalledWith(
      'convencao-01',
      'RESUMIDA',
    );
    expect(criarEndereco).toHaveBeenCalledWith(arquivo);
    expect(abrirJanela).toHaveBeenCalledWith('blob:pdf', '_blank');
  });

  it('avisa quando não consegue carregar as convenções', async () => {
    vi.mocked(api.listarConvencoes).mockRejectedValue(
      new TypeError('Failed to fetch'),
    );

    render(<PaginaConvencoes />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar as convenções.',
    );
  });
});
