import type { ApiClient, AssociadoDetalhe } from '@eloconnect/shared';
import { ApiError } from '@eloconnect/shared';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../api';
import { PaginaPerfilAssociado } from './PaginaPerfilAssociado';

vi.mock('../../api', () => ({
  api: {
    buscarAssociado: vi.fn<ApiClient['buscarAssociado']>(),
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
    ...dados,
  };
}

function abrir() {
  render(
    <MemoryRouter initialEntries={['/admin/associados/id-01']}>
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
});
