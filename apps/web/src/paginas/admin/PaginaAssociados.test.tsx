import type {
  ApiClient,
  AssociadoResumo,
  ListaAssociados,
} from '@eloconnect/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../api';
import { entrarComo } from '../../test/sessao';
import { PaginaAssociados } from './PaginaAssociados';

vi.mock('../../api', () => ({
  api: {
    listarAssociados: vi.fn<ApiClient['listarAssociados']>(),
  },
}));

function associado(dados: Partial<AssociadoResumo>): AssociadoResumo {
  return {
    id: 'id-01',
    cnpj: '11222333000181',
    razaoSocial: 'Farmácia Exemplo 01 Ltda',
    nomeFantasia: null,
    situacao: 'ADIMPLENTE',
    acessoManual: null,
    acessoManualAte: null,
    contribuicaoAtiva: false,
    cancelamentoSolicitado: false,
    inativadoEm: null,
    ...dados,
  };
}

function lista(dados: Partial<ListaAssociados>): ListaAssociados {
  return { itens: [], total: 0, pagina: 1, porPagina: 20, ...dados };
}

function abrir(endereco = '/admin/associados') {
  render(
    <MemoryRouter initialEntries={[endereco]}>
      <PaginaAssociados />
    </MemoryRouter>,
  );
}

describe('PaginaAssociados', () => {
  beforeEach(() => {
    entrarComo('ADMIN');
    vi.mocked(api.listarAssociados).mockReset();
    vi.mocked(api.listarAssociados).mockResolvedValue(lista({}));
  });

  it('o perfil básico da sede não vê o botão de cadastrar (RN33)', async () => {
    entrarComo('ADMIN_BASICO');
    abrir();

    await screen.findByText('Nenhum associado encontrado.');
    expect(
      screen.queryByRole('link', { name: 'Cadastrar associado' }),
    ).not.toBeInTheDocument();
  });

  it('mostra cada associado com a situação em texto e o link do perfil', async () => {
    vi.mocked(api.listarAssociados).mockResolvedValue(
      lista({
        total: 2,
        itens: [
          associado({
            nomeFantasia: 'Exemplo Centro',
            contribuicaoAtiva: true,
          }),
          associado({
            id: 'id-02',
            cnpj: '12ABC34501DE35',
            razaoSocial: 'Drogaria Exemplo 02 Ltda',
            situacao: 'INADIMPLENTE',
            acessoManual: 'BLOQUEADO',
            cancelamentoSolicitado: true,
            inativadoEm: '2026-10-01T12:00:00.000Z',
          }),
        ],
      }),
    );
    abrir();

    expect(await screen.findByRole('status')).toHaveTextContent(
      '2 associados encontrados.',
    );
    const [, primeira, segunda] = screen.getAllByRole('row');
    expect(primeira).toHaveTextContent('Exemplo Centro');
    expect(primeira).toHaveTextContent('11.222.333/0001-81');
    expect(primeira).toHaveTextContent('Adimplente');
    expect(primeira).toHaveTextContent('Sim');
    expect(segunda).toHaveTextContent('12.ABC.345/01DE-35');
    // Não contribui: "Sem contribuição ativa", e não "Inadimplente" (RN22).
    expect(segunda).toHaveTextContent('Sem contribuição ativa');
    expect(segunda).not.toHaveTextContent('Inadimplente');
    expect(segunda).toHaveTextContent('Cancelamento solicitado');
    expect(segunda).toHaveTextContent('Acesso bloqueado pela sede');
    expect(segunda).toHaveTextContent('Inativado');
    expect(segunda).toHaveTextContent('Não');
    expect(
      screen.getByRole('link', { name: 'Drogaria Exemplo 02 Ltda' }),
    ).toHaveAttribute('href', '/admin/associados/id-02');
    expect(
      screen.getByRole('link', { name: 'Cadastrar associado' }),
    ).toHaveAttribute('href', '/admin/associados/novo');
  });

  it('busca com os filtros escolhidos', async () => {
    abrir();
    await screen.findByText('Nenhum associado encontrado.');

    await userEvent.type(
      screen.getByLabelText('Buscar por nome ou CNPJ'),
      ' exemplo ',
    );
    await userEvent.selectOptions(
      screen.getByLabelText('Situação'),
      'INADIMPLENTE',
    );
    await userEvent.selectOptions(
      screen.getByLabelText('Recebe boleto mensal'),
      'true',
    );
    await userEvent.click(
      screen.getByLabelText('Mostrar também os inativados'),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(api.listarAssociados).toHaveBeenLastCalledWith({
      busca: 'exemplo',
      status: 'INADIMPLENTE',
      contribuicaoAtiva: true,
      incluirInativos: true,
    });
  });

  it('lê os filtros do endereço e ignora os valores inválidos', async () => {
    abrir(
      '/admin/associados?busca=exemplo&status=OUTRO&contribuicaoAtiva=false&pagina=2',
    );
    await screen.findByText('Nenhum associado encontrado.');

    expect(api.listarAssociados).toHaveBeenCalledWith({
      busca: 'exemplo',
      contribuicaoAtiva: false,
      pagina: 2,
    });
    expect(screen.getByLabelText('Buscar por nome ou CNPJ')).toHaveValue(
      'exemplo',
    );
    expect(screen.getByLabelText('Recebe boleto mensal')).toHaveValue('false');
  });

  it('passa de página', async () => {
    vi.mocked(api.listarAssociados).mockResolvedValue(
      lista({ total: 45, itens: [associado({})] }),
    );
    abrir();

    expect(await screen.findByText('Página 1 de 3')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Página anterior' }),
    ).toBeDisabled();
    await userEvent.click(
      screen.getByRole('button', { name: 'Próxima página' }),
    );

    expect(api.listarAssociados).toHaveBeenLastCalledWith({ pagina: 2 });
  });

  it('avisa quando a API não responde', async () => {
    vi.mocked(api.listarAssociados).mockRejectedValue(
      new TypeError('Failed to fetch'),
    );
    abrir();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar a lista agora.',
    );
  });
});
