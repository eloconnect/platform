import type { ApiClient, AssociadoDetalhe } from '@eloconnect/shared';
import { ApiError } from '@eloconnect/shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../api';
import { PaginaPerfilAssociado } from './PaginaPerfilAssociado';

vi.mock('../../api', () => ({
  api: {
    buscarAssociado: vi.fn<ApiClient['buscarAssociado']>(),
    inativarAssociado: vi.fn<ApiClient['inativarAssociado']>(),
    reativarAssociado: vi.fn<ApiClient['reativarAssociado']>(),
  },
}));

function associado(dados: Partial<AssociadoDetalhe> = {}): AssociadoDetalhe {
  return {
    id: 'id-01',
    cnpj: '11222333000181',
    razaoSocial: 'Farmácia Exemplo 01 Ltda',
    nomeFantasia: 'Exemplo Centro',
    email: 'contato@example.com',
    telefone: null,
    municipio: 'Cuiabá',
    contribuicaoAtiva: true,
    situacao: 'ADIMPLENTE',
    acessoManual: null,
    inativadoEm: null,
    criadoEm: '2026-10-01T12:00:00.000Z',
    atualizadoEm: '2026-10-01T12:00:00.000Z',
    cancelamentos: [],
    conta: null,
    ...dados,
  };
}

function abrir(state?: unknown) {
  render(
    <MemoryRouter
      initialEntries={[{ pathname: '/admin/associados/id-01', state }]}
    >
      <Routes>
        <Route
          path="/admin/associados/:id"
          element={<PaginaPerfilAssociado />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

function secao(titulo: string): HTMLElement {
  const elemento = screen
    .getByRole('heading', { level: 2, name: titulo })
    .closest('section');
  if (!elemento) throw new Error(`Seção "${titulo}" não encontrada.`);
  return elemento;
}

describe('PaginaPerfilAssociado', () => {
  beforeEach(() => {
    vi.mocked(api.buscarAssociado).mockReset();
    vi.mocked(api.inativarAssociado).mockReset();
    vi.mocked(api.reativarAssociado).mockReset();
  });

  it('mostra a situação, os dados cadastrais e o espaço dos boletos', async () => {
    vi.mocked(api.buscarAssociado).mockResolvedValue(associado());
    abrir();

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Farmácia Exemplo 01 Ltda',
      }),
    ).toBeInTheDocument();
    expect(api.buscarAssociado).toHaveBeenCalledWith('id-01');
    const situacao = secao('Situação');
    expect(situacao).toHaveTextContent('Adimplente');
    expect(situacao).toHaveTextContent('Recebe boleto mensal: Sim');
    const dados = secao('Dados cadastrais');
    expect(dados).toHaveTextContent('11.222.333/0001-81');
    expect(dados).toHaveTextContent('Exemplo Centro');
    expect(dados).toHaveTextContent('contato@example.com');
    expect(dados).toHaveTextContent('TelefoneNão informado');
    expect(dados).toHaveTextContent('01/10/2026');
    expect(secao('Conta de acesso')).toHaveTextContent(
      'Ainda não criada pelo associado.',
    );
    expect(secao('Solicitações de cancelamento')).toHaveTextContent(
      'Nenhuma solicitação.',
    );
    expect(secao('Histórico de boletos e pagamentos')).toHaveTextContent(
      'Em construção.',
    );
    expect(
      screen.getByRole('link', { name: 'Voltar para a lista de associados' }),
    ).toHaveAttribute('href', '/admin/associados');
  });

  it.each([
    [
      'aguardando a senha',
      { confirmadaEm: null },
      'Pedida em 20/10/2026. Aguardando o associado criar a senha pelo link enviado para conta@example.com.',
    ],
    [
      'criada',
      { confirmadaEm: '2026-10-21T12:00:00.000Z' },
      'Criada em 21/10/2026. O associado entra com o e-mail conta@example.com.',
    ],
  ])('mostra a conta de acesso %s', async (_caso, conta, texto) => {
    vi.mocked(api.buscarAssociado).mockResolvedValue(
      associado({
        conta: {
          email: 'conta@example.com',
          criadaEm: '2026-10-20T12:00:00.000Z',
          ...conta,
        },
      }),
    );
    abrir();

    await screen.findByRole('heading', { level: 1 });
    expect(secao('Conta de acesso')).toHaveTextContent(texto);
  });

  it('mostra as marcas da situação e as solicitações de cancelamento', async () => {
    vi.mocked(api.buscarAssociado).mockResolvedValue(
      associado({
        situacao: 'INADIMPLENTE',
        acessoManual: 'BLOQUEADO',
        contribuicaoAtiva: false,
        inativadoEm: '2026-10-20T12:00:00.000Z',
        cancelamentos: [
          {
            id: 'c2',
            status: 'PENDENTE',
            motivo: 'Motivo fictício',
            observacaoSede: null,
            solicitadaEm: '2026-10-10T12:00:00.000Z',
            decididaEm: null,
            decididaPor: null,
          },
          {
            id: 'c1',
            status: 'RECUSADA',
            motivo: null,
            observacaoSede: 'Observação fictícia',
            solicitadaEm: '2026-09-01T12:00:00.000Z',
            decididaEm: '2026-09-02T12:00:00.000Z',
            decididaPor: { nome: 'Admin de Exemplo' },
          },
        ],
      }),
    );
    abrir();

    await screen.findByRole('heading', { level: 1 });
    const situacao = secao('Situação');
    for (const texto of [
      'Inadimplente',
      'Cancelamento solicitado',
      'Acesso bloqueado pela sede',
      'Inativado',
      'Recebe boleto mensal: Não',
    ]) {
      expect(situacao).toHaveTextContent(texto);
    }
    expect(secao('Dados cadastrais')).toHaveTextContent(
      'Inativado em20/10/2026',
    );
    const [pendente, recusada] = within(
      secao('Solicitações de cancelamento'),
    ).getAllByRole('listitem');
    expect(pendente).toHaveTextContent('Pendente, pedida em 10/10/2026.');
    expect(pendente).toHaveTextContent('Motivo: Motivo fictício');
    expect(recusada).toHaveTextContent('Recusada, pedida em 01/09/2026.');
    expect(recusada).toHaveTextContent(
      'Decidida em 02/09/2026 por Admin de Exemplo.',
    );
    expect(recusada).toHaveTextContent(
      'Observação da sede: Observação fictícia',
    );
  });

  it.each([404, 400])(
    'com %i avisa que o associado não existe',
    async (status) => {
      vi.mocked(api.buscarAssociado).mockRejectedValue(
        new ApiError(status, 'erro'),
      );
      abrir();

      expect(
        await screen.findByRole('heading', {
          level: 1,
          name: 'Associado não encontrado',
        }),
      ).toBeInTheDocument();
    },
  );

  it('avisa quando a API não responde', async () => {
    vi.mocked(api.buscarAssociado).mockRejectedValue(
      new TypeError('Failed to fetch'),
    );
    abrir();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar o associado agora.',
    );
  });
  it('mostra o aviso deixado pelo formulário e o link para editar', async () => {
    vi.mocked(api.buscarAssociado).mockResolvedValue(associado());
    abrir({ aviso: 'Dados salvos.' });

    expect(
      await screen.findByRole('link', { name: 'Editar dados' }),
    ).toHaveAttribute('href', '/admin/associados/id-01/editar');
    expect(screen.getByRole('status')).toHaveTextContent('Dados salvos.');
  });

  it('inativa depois de confirmar', async () => {
    vi.mocked(api.buscarAssociado).mockResolvedValue(associado());
    vi.mocked(api.inativarAssociado).mockResolvedValue(
      associado({ inativadoEm: '2026-10-20T12:00:00.000Z' }),
    );
    abrir();

    await userEvent.click(
      await screen.findByRole('button', { name: 'Inativar associado' }),
    );
    const janela = await screen.findByRole('dialog', {
      name: 'Inativar associado?',
    });
    expect(janela).toHaveTextContent(
      'Farmácia Exemplo 01 Ltda deixa de aparecer na lista de associados.',
    );
    await userEvent.click(
      within(janela).getByRole('button', { name: 'Sim, inativar' }),
    );

    expect(api.inativarAssociado).toHaveBeenCalledWith('id-01');
    expect(await screen.findByText('Associado inativado.')).toBeInTheDocument();
    expect(secao('Situação')).toHaveTextContent('Inativado');
    expect(
      screen.getByRole('button', { name: 'Reativar associado' }),
    ).toBeInTheDocument();
  });

  it('não inativa quando cancela', async () => {
    vi.mocked(api.buscarAssociado).mockResolvedValue(associado());
    abrir();

    await userEvent.click(
      await screen.findByRole('button', { name: 'Inativar associado' }),
    );
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Cancelar',
      }),
    );

    expect(api.inativarAssociado).not.toHaveBeenCalled();
  });

  it('reativa o associado inativado depois de confirmar', async () => {
    vi.mocked(api.buscarAssociado).mockResolvedValue(
      associado({ inativadoEm: '2026-10-20T12:00:00.000Z' }),
    );
    vi.mocked(api.reativarAssociado).mockResolvedValue(associado());
    abrir();

    await userEvent.click(
      await screen.findByRole('button', { name: 'Reativar associado' }),
    );
    await userEvent.click(
      within(
        await screen.findByRole('dialog', { name: 'Reativar associado?' }),
      ).getByRole('button', { name: 'Sim, reativar' }),
    );

    expect(api.reativarAssociado).toHaveBeenCalledWith('id-01');
    expect(await screen.findByText('Associado reativado.')).toBeInTheDocument();
    expect(secao('Situação')).not.toHaveTextContent('Inativado');
  });

  it('avisa na janela quando não consegue inativar', async () => {
    vi.mocked(api.buscarAssociado).mockResolvedValue(associado());
    vi.mocked(api.inativarAssociado).mockRejectedValue(
      new ApiError(500, 'erro'),
    );
    abrir();

    await userEvent.click(
      await screen.findByRole('button', { name: 'Inativar associado' }),
    );
    const janela = await screen.findByRole('dialog');
    await userEvent.click(
      within(janela).getByRole('button', { name: 'Sim, inativar' }),
    );

    expect(await within(janela).findByRole('alert')).toHaveTextContent(
      'Não foi possível inativar agora.',
    );
  });
});
