import type { ApiClient, Beneficio } from '@eloconnect/shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../api';
import { entrarComo } from '../../test/sessao';
import { PaginaBeneficios } from './PaginaBeneficios';

vi.mock('../../api', () => ({
  api: {
    listarBeneficios: vi.fn<ApiClient['listarBeneficios']>(),
    criarBeneficio: vi.fn<ApiClient['criarBeneficio']>(),
    editarBeneficio: vi.fn<ApiClient['editarBeneficio']>(),
    removerBeneficio: vi.fn<ApiClient['removerBeneficio']>(),
  },
}));

const JURIDICA: Beneficio = {
  id: 'beneficio-01',
  titulo: 'Assessoria trabalhista',
  descricao: 'Primeira linha.\nSegunda linha.',
  grupo: 'ASSESSORIA_JURIDICA',
};

const CONSULTORIA: Beneficio = {
  id: 'beneficio-02',
  titulo: 'Consultoria fiscal',
  descricao: 'Descrição fictícia.',
  grupo: 'CONSULTORIA',
};

async function abrir() {
  render(<PaginaBeneficios />);
  await screen.findByRole('button', { name: 'Cadastrar benefício' });
}

describe('PaginaBeneficios', () => {
  beforeEach(() => {
    entrarComo('ADMIN_BASICO');
    vi.mocked(api.listarBeneficios).mockResolvedValue([JURIDICA, CONSULTORIA]);
    vi.mocked(api.criarBeneficio).mockReset();
    vi.mocked(api.editarBeneficio).mockReset();
    vi.mocked(api.removerBeneficio).mockReset();
  });

  it('mostra os benefícios separados pelos dois grupos', async () => {
    await abrir();

    const juridica = screen.getByRole('region', {
      name: 'Assessoria jurídica',
    });
    expect(
      within(juridica).getByRole('heading', { name: 'Assessoria trabalhista' }),
    ).toBeInTheDocument();
    expect(within(juridica).getByText(/Primeira linha\./)).toHaveClass(
      'texto-com-quebras',
    );
    expect(
      within(screen.getByRole('region', { name: 'Consultoria' })).getByRole(
        'heading',
        { name: 'Consultoria fiscal' },
      ),
    ).toBeInTheDocument();
  });

  it('avisa quando um grupo está vazio', async () => {
    vi.mocked(api.listarBeneficios).mockResolvedValue([CONSULTORIA]);
    await abrir();

    expect(
      within(
        screen.getByRole('region', { name: 'Assessoria jurídica' }),
      ).getByText('Nenhum benefício neste grupo.'),
    ).toBeInTheDocument();
  });

  it('cadastra com nome, descrição e grupo', async () => {
    const novo: Beneficio = {
      id: 'beneficio-03',
      titulo: 'Assessoria cível',
      descricao: 'Descrição nova.',
      grupo: 'ASSESSORIA_JURIDICA',
    };
    vi.mocked(api.criarBeneficio).mockResolvedValue(novo);
    await abrir();

    await userEvent.click(
      screen.getByRole('button', { name: 'Cadastrar benefício' }),
    );
    const janela = screen.getByRole('dialog', { name: 'Cadastrar benefício' });
    await userEvent.type(
      within(janela).getByLabelText(/Nome do benefício/),
      '  Assessoria cível ',
    );
    await userEvent.type(
      within(janela).getByLabelText(/Descrição/),
      'Descrição nova.',
    );
    await userEvent.click(within(janela).getByLabelText('Assessoria jurídica'));
    await userEvent.click(
      within(janela).getByRole('button', { name: 'Salvar' }),
    );

    expect(api.criarBeneficio).toHaveBeenCalledWith({
      titulo: 'Assessoria cível',
      descricao: 'Descrição nova.',
      grupo: 'ASSESSORIA_JURIDICA',
    });
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Benefício cadastrado.',
    );
    expect(
      within(
        screen.getByRole('region', { name: 'Assessoria jurídica' }),
      ).getByRole('heading', { name: 'Assessoria cível' }),
    ).toBeInTheDocument();
  });

  it('não salva sem nome e descrição', async () => {
    await abrir();

    await userEvent.click(
      screen.getByRole('button', { name: 'Cadastrar benefício' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(
      screen.getByText('Escreva o nome do benefício.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Escreva a descrição do benefício.'),
    ).toBeInTheDocument();
    expect(api.criarBeneficio).not.toHaveBeenCalled();
  });

  it('edita com os dados atuais já preenchidos', async () => {
    vi.mocked(api.editarBeneficio).mockResolvedValue({
      ...CONSULTORIA,
      titulo: 'Consultoria contábil',
    });
    await abrir();

    await userEvent.click(
      screen.getByRole('button', { name: 'Editar Consultoria fiscal' }),
    );
    const janela = screen.getByRole('dialog', { name: 'Editar benefício' });
    const nome = within(janela).getByLabelText(/Nome do benefício/);
    expect(nome).toHaveValue('Consultoria fiscal');
    expect(within(janela).getByLabelText('Consultoria')).toBeChecked();
    await userEvent.clear(nome);
    await userEvent.type(nome, 'Consultoria contábil');
    await userEvent.click(
      within(janela).getByRole('button', { name: 'Salvar' }),
    );

    expect(api.editarBeneficio).toHaveBeenCalledWith('beneficio-02', {
      titulo: 'Consultoria contábil',
      descricao: 'Descrição fictícia.',
      grupo: 'CONSULTORIA',
    });
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Benefício alterado.',
    );
    expect(
      screen.getByRole('heading', { name: 'Consultoria contábil' }),
    ).toBeInTheDocument();
  });

  it('remove depois da confirmação', async () => {
    vi.mocked(api.removerBeneficio).mockResolvedValue(CONSULTORIA);
    await abrir();

    await userEvent.click(
      screen.getByRole('button', { name: 'Remover Consultoria fiscal' }),
    );
    const janela = screen.getByRole('dialog', { name: 'Remover benefício?' });
    expect(janela).toHaveTextContent(
      'Consultoria fiscal deixa de aparecer na página inicial e no sistema.',
    );
    await userEvent.click(
      within(janela).getByRole('button', { name: 'Sim, remover' }),
    );

    expect(api.removerBeneficio).toHaveBeenCalledWith('beneficio-02');
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Benefício removido.',
    );
    expect(
      screen.queryByRole('heading', { name: 'Consultoria fiscal' }),
    ).not.toBeInTheDocument();
  });

  it('avisa na janela quando não consegue salvar', async () => {
    vi.mocked(api.criarBeneficio).mockRejectedValue(
      new TypeError('Failed to fetch'),
    );
    await abrir();

    await userEvent.click(
      screen.getByRole('button', { name: 'Cadastrar benefício' }),
    );
    await userEvent.type(screen.getByLabelText(/Nome do benefício/), 'Nome');
    await userEvent.type(screen.getByLabelText(/Descrição/), 'Texto');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível salvar agora.',
    );
  });

  it('avisa quando não consegue carregar a lista', async () => {
    vi.mocked(api.listarBeneficios).mockRejectedValue(
      new TypeError('Failed to fetch'),
    );
    render(<PaginaBeneficios />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar os benefícios agora.',
    );
  });
});
