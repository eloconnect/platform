import type { ApiClient, Convencao } from '@eloconnect/shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
