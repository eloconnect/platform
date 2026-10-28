import type { ApiClient, AssociadoDetalhe } from '@eloconnect/shared';
import { ApiError } from '@eloconnect/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../api';
import { PaginaFormularioAssociado } from './PaginaFormularioAssociado';

vi.mock('../../api', () => ({
  api: {
    buscarAssociado: vi.fn<ApiClient['buscarAssociado']>(),
    criarAssociado: vi.fn<ApiClient['criarAssociado']>(),
    editarAssociado: vi.fn<ApiClient['editarAssociado']>(),
  },
}));

const ASSOCIADO: AssociadoDetalhe = {
  id: 'id-01',
  cnpj: '11222333000181',
  razaoSocial: 'Farmácia Exemplo 01 Ltda',
  nomeFantasia: null,
  email: 'contato@example.com',
  telefone: null,
  municipio: 'Cuiabá',
  contribuicaoAtiva: true,
  situacao: 'ADIMPLENTE',
  acessoManual: null,
  acessoManualAte: null,
  inativadoEm: null,
  criadoEm: '2026-10-01T12:00:00.000Z',
  atualizadoEm: '2026-10-01T12:00:00.000Z',
  cancelamentos: [],
  conta: null,
};

/** No lugar do perfil: mostra o aviso que o formulário deixou. */
function PerfilFalso() {
  const { state } = useLocation();
  return <p>Perfil aberto: {JSON.stringify(state)}</p>;
}

function abrir(endereco: string) {
  render(
    <MemoryRouter initialEntries={[endereco]}>
      <Routes>
        <Route
          path="/admin/associados/novo"
          element={<PaginaFormularioAssociado />}
        />
        <Route
          path="/admin/associados/:id/editar"
          element={<PaginaFormularioAssociado />}
        />
        <Route path="/admin/associados/:id" element={<PerfilFalso />} />
      </Routes>
    </MemoryRouter>,
  );
}

const campo = (rotulo: RegExp) => screen.getByLabelText(rotulo);
const salvar = () =>
  userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

async function preencherCadastro(cnpj: string) {
  await userEvent.type(campo(/^CNPJ/), cnpj);
  await userEvent.type(campo(/^Razão social/), 'Farmácia Nova Ltda');
  await userEvent.type(campo(/^Município/), 'Sinop');
  await userEvent.click(screen.getByLabelText('Sim'));
}

describe('PaginaFormularioAssociado', () => {
  beforeEach(() => {
    vi.mocked(api.buscarAssociado).mockReset();
    vi.mocked(api.criarAssociado).mockReset();
    vi.mocked(api.editarAssociado).mockReset();
  });

  it('cadastra e abre o perfil com o aviso', async () => {
    vi.mocked(api.criarAssociado).mockResolvedValue({
      ...ASSOCIADO,
      id: 'id-novo',
    });
    abrir('/admin/associados/novo');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Cadastrar associado' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Não')).toBeChecked();

    await preencherCadastro('11.222.333/0001-81');
    await salvar();

    expect(api.criarAssociado).toHaveBeenCalledWith({
      cnpj: '11.222.333/0001-81',
      razaoSocial: 'Farmácia Nova Ltda',
      nomeFantasia: '',
      email: '',
      telefone: '',
      municipio: 'Sinop',
      contribuicaoAtiva: true,
    });
    expect(await screen.findByText(/Perfil aberto/)).toHaveTextContent(
      'Associado cadastrado.',
    );
  });

  it('não envia com o CNPJ inválido e explica no campo', async () => {
    abrir('/admin/associados/novo');
    await preencherCadastro('11.222.333/0001-82');
    await salvar();

    expect(api.criarAssociado).not.toHaveBeenCalled();
    expect(campo(/^CNPJ/)).toHaveAccessibleDescription(
      /CNPJ inválido. Confira os números digitados./,
    );
    expect(campo(/^CNPJ/)).toHaveFocus();
  });

  it('com 409 avisa que o CNPJ já existe', async () => {
    vi.mocked(api.criarAssociado).mockRejectedValue(new ApiError(409, 'erro'));
    abrir('/admin/associados/novo');
    await preencherCadastro('11.222.333/0001-81');
    await salvar();

    expect(campo(/^CNPJ/)).toHaveAccessibleDescription(
      /Já existe um associado com este CNPJ./,
    );
  });

  it.each([
    [400, 'Confira os dados digitados e tente de novo.'],
    [500, 'Não foi possível salvar agora.'],
  ])('com %i mostra a mensagem certa', async (status, mensagem) => {
    vi.mocked(api.criarAssociado).mockRejectedValue(
      new ApiError(status, 'erro'),
    );
    abrir('/admin/associados/novo');
    await preencherCadastro('11.222.333/0001-81');
    await salvar();

    expect(await screen.findByRole('alert')).toHaveTextContent(mensagem);
  });

  it('edita a partir dos dados atuais', async () => {
    vi.mocked(api.buscarAssociado).mockResolvedValue(ASSOCIADO);
    vi.mocked(api.editarAssociado).mockResolvedValue(ASSOCIADO);
    abrir('/admin/associados/id-01/editar');

    expect(await screen.findByLabelText(/^CNPJ/)).toHaveValue(
      '11.222.333/0001-81',
    );
    expect(campo(/^Razão social/)).toHaveValue('Farmácia Exemplo 01 Ltda');
    expect(campo(/^Telefone/)).toHaveValue('');
    expect(screen.getByLabelText('Sim')).toBeChecked();
    expect(screen.getByRole('link', { name: 'Cancelar' })).toHaveAttribute(
      'href',
      '/admin/associados/id-01',
    );

    await userEvent.clear(campo(/^E-mail/));
    await userEvent.click(screen.getByLabelText('Não'));
    await salvar();

    expect(api.editarAssociado).toHaveBeenCalledWith('id-01', {
      cnpj: '11.222.333/0001-81',
      razaoSocial: 'Farmácia Exemplo 01 Ltda',
      nomeFantasia: '',
      email: '',
      telefone: '',
      municipio: 'Cuiabá',
      contribuicaoAtiva: false,
    });
    expect(await screen.findByText(/Perfil aberto/)).toHaveTextContent(
      'Dados salvos.',
    );
  });

  describe('associado com conta de acesso (RN34)', () => {
    const COM_CONTA: AssociadoDetalhe = {
      ...ASSOCIADO,
      conta: {
        email: 'contato@example.com',
        criadaEm: '2026-10-20T12:00:00.000Z',
        confirmadaEm: '2026-10-20T12:00:00.000Z',
      },
    };

    it('avisa que o e-mail também é o de acesso', async () => {
      vi.mocked(api.buscarAssociado).mockResolvedValue(COM_CONTA);
      abrir('/admin/associados/id-01/editar');

      expect(
        await screen.findByLabelText(/^E-mail/),
      ).toHaveAccessibleDescription(/É também o e-mail de acesso do associado/);
      expect(campo(/^E-mail/)).toBeRequired();
    });

    it('com 409 no e-mail, avisa no campo do e-mail', async () => {
      vi.mocked(api.buscarAssociado).mockResolvedValue(COM_CONTA);
      vi.mocked(api.editarAssociado).mockRejectedValue(
        new ApiError(409, 'erro', 'email'),
      );
      abrir('/admin/associados/id-01/editar');
      await screen.findByLabelText(/^CNPJ/);

      await salvar();

      expect(campo(/^E-mail/)).toHaveAccessibleDescription(
        /Este e-mail já é usado na conta de outra farmácia./,
      );
      expect(campo(/^CNPJ/)).not.toHaveAccessibleDescription(/Já existe/);
    });
  });

  it('avisa quando o associado não existe', async () => {
    vi.mocked(api.buscarAssociado).mockRejectedValue(new ApiError(404, 'erro'));
    abrir('/admin/associados/id-99/editar');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Associado não encontrado.',
    );
  });
});
