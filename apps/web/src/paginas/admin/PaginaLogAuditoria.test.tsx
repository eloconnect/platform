import type {
  ApiClient,
  ItemLogAuditoria,
  ListaLogAuditoria,
} from '@eloconnect/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../api';
import { entrarComo } from '../../test/sessao';
import { PaginaLogAuditoria } from './PaginaLogAuditoria';

vi.mock('../../api', () => ({
  api: {
    listarLogAuditoria: vi.fn<ApiClient['listarLogAuditoria']>(),
    listarUsuariosSede: vi.fn<ApiClient['listarUsuariosSede']>(),
  },
}));

const ANA = { id: '019a0000-0000-7000-8000-000000000001', nome: 'Ana' };
const BRUNO = { id: '019a0000-0000-7000-8000-000000000002', nome: 'Bruno' };

function item(dados: Partial<ItemLogAuditoria>): ItemLogAuditoria {
  return {
    id: 'log-01',
    ocorridoEm: '2026-10-28T18:05:00.000Z',
    acao: 'ASSOCIADO_EDITADO',
    usuario: ANA,
    associado: {
      id: 'associado-01',
      cnpj: '11222333000181',
      razaoSocial: 'Farmácia Exemplo 01 Ltda',
    },
    registro: null,
    valorAnterior: null,
    valorNovo: null,
    ...dados,
  };
}

function lista(dados: Partial<ListaLogAuditoria>): ListaLogAuditoria {
  return { itens: [], total: 0, pagina: 1, porPagina: 20, ...dados };
}

function abrir(endereco = '/admin/auditoria') {
  render(
    <MemoryRouter initialEntries={[endereco]}>
      <PaginaLogAuditoria />
    </MemoryRouter>,
  );
}

describe('PaginaLogAuditoria', () => {
  beforeEach(() => {
    entrarComo('ADMIN');
    vi.mocked(api.listarLogAuditoria).mockReset();
    vi.mocked(api.listarLogAuditoria).mockResolvedValue(lista({}));
    vi.mocked(api.listarUsuariosSede).mockResolvedValue([ANA, BRUNO]);
  });

  it('mostra quando, quem, a ação, o associado e o que mudou', async () => {
    vi.mocked(api.listarLogAuditoria).mockResolvedValue(
      lista({
        total: 3,
        itens: [
          item({
            id: 'log-03',
            acao: 'ACESSO_BLOQUEADO',
            usuario: BRUNO,
            valorAnterior: { acessoManual: null },
            valorNovo: { acessoManual: 'BLOQUEADO', motivo: 'Motivo fictício' },
          }),
          item({
            id: 'log-02',
            valorAnterior: { telefone: null, contribuicaoAtiva: false },
            valorNovo: { telefone: '(65) 90000-0000', contribuicaoAtiva: true },
          }),
          item({
            id: 'log-01',
            acao: 'VALOR_ALTERADO',
            associado: null,
            valorNovo: { valorMensal: '120.00' },
          }),
        ],
      }),
    );
    abrir();

    expect(await screen.findByRole('status')).toHaveTextContent(
      '3 ações encontradas.',
    );
    const [, bloqueio, edicao, valor] = screen.getAllByRole('row');
    // 18:05 em UTC é 14:05 em Mato Grosso.
    expect(bloqueio).toHaveTextContent('28/10/2026, 14:05');
    expect(bloqueio).toHaveTextContent('Bruno');
    expect(bloqueio).toHaveTextContent('Acesso bloqueado');
    expect(bloqueio).toHaveTextContent('11.222.333/0001-81');
    expect(bloqueio).toHaveTextContent(
      'Acesso: Segue o pagamento → Bloqueado pela sede',
    );
    expect(bloqueio).toHaveTextContent('Motivo: Motivo fictício');
    expect(edicao).toHaveTextContent('Cadastro editado');
    expect(edicao).toHaveTextContent('Telefone: vazio → (65) 90000-0000');
    expect(edicao).toHaveTextContent('Recebe boleto mensal: Não → Sim');
    expect(valor).toHaveTextContent('Valor da contribuição alterado');
    expect(valor).toHaveTextContent('Valor mensal: 120.00');
    expect(
      screen.getAllByRole('link', { name: 'Farmácia Exemplo 01 Ltda' })[0],
    ).toHaveAttribute('href', '/admin/associados/associado-01');
  });

  it('diz qual benefício a ação afetou, com o nome do grupo', async () => {
    vi.mocked(api.listarLogAuditoria).mockResolvedValue(
      lista({
        total: 1,
        itens: [
          item({
            acao: 'BENEFICIO_EDITADO',
            associado: null,
            registro: { tipo: 'Benefício', nome: 'Benefício de exemplo 1' },
            valorAnterior: { grupo: 'CONSULTORIA' },
            valorNovo: { grupo: 'ASSESSORIA_JURIDICA' },
          }),
        ],
      }),
    );
    abrir();

    const [, linha] = await screen.findAllByRole('row');
    expect(linha).toHaveTextContent('Benefício editado');
    expect(linha).toHaveTextContent('Benefício: Benefício de exemplo 1');
    expect(linha).toHaveTextContent('Grupo: Consultoria → Assessoria jurídica');
  });

  it('diz qual notícia a ação afetou', async () => {
    vi.mocked(api.listarLogAuditoria).mockResolvedValue(
      lista({
        total: 1,
        itens: [
          item({
            acao: 'NOTICIA_EDITADA',
            associado: null,
            registro: { tipo: 'Notícia', nome: 'Reunião da diretoria' },
            valorAnterior: { conteudo: 'Texto antigo.' },
            valorNovo: { conteudo: 'Texto novo.' },
          }),
        ],
      }),
    );
    abrir();

    const [, linha] = await screen.findAllByRole('row');
    expect(linha).toHaveTextContent('Notícia editada');
    expect(linha).toHaveTextContent('Notícia: Reunião da diretoria');
    expect(linha).toHaveTextContent('Texto: Texto antigo. → Texto novo.');
  });

  it('diz o mês e o valor do boleto mudado pela sede', async () => {
    vi.mocked(api.listarLogAuditoria).mockResolvedValue(
      lista({
        total: 1,
        itens: [
          item({
            acao: 'BOLETO_VALOR_EDITADO',
            valorAnterior: { valor: '120.00' },
            valorNovo: { competencia: '2026-12', valor: '100.00' },
          }),
        ],
      }),
    );
    abrir();

    const [, linha] = await screen.findAllByRole('row');
    expect(linha).toHaveTextContent('Valor do próximo boleto mudado');
    expect(linha).toHaveTextContent('Farmácia Exemplo 01 Ltda');
    expect(linha).toHaveTextContent('Mês do boleto: dezembro de 2026');
    expect(linha).toHaveTextContent('Valor do boleto: 120.00 → 100.00');
  });

  it('diz qual convenção a ação afetou e o PDF enviado', async () => {
    vi.mocked(api.listarLogAuditoria).mockResolvedValue(
      lista({
        total: 1,
        itens: [
          item({
            acao: 'CONVENCAO_ANEXOS_ATUALIZADOS',
            associado: null,
            registro: { tipo: 'Convenção', nome: 'Convenção Coletiva 2026' },
            valorNovo: { pdfIntegral: 'Convenção completa.pdf' },
          }),
        ],
      }),
    );
    abrir();

    const [, linha] = await screen.findAllByRole('row');
    expect(linha).toHaveTextContent('PDFs da convenção atualizados');
    expect(linha).toHaveTextContent('Convenção: Convenção Coletiva 2026');
    expect(linha).toHaveTextContent('PDF integral: Convenção completa.pdf');
  });

  it('filtra por quem fez, ação, associado e período', async () => {
    abrir();
    await screen.findByText('Nenhuma ação encontrada.');
    await screen.findByRole('option', { name: 'Bruno' });

    await userEvent.selectOptions(screen.getByLabelText('Quem fez'), 'Bruno');
    await userEvent.selectOptions(
      screen.getByLabelText('Ação'),
      'Acesso liberado',
    );
    await userEvent.type(
      screen.getByLabelText('Associado (nome ou CNPJ)'),
      ' exemplo ',
    );
    await userEvent.type(screen.getByLabelText('De'), '2026-10-01');
    await userEvent.type(screen.getByLabelText('Até'), '2026-10-28');
    await userEvent.click(screen.getByRole('button', { name: 'Filtrar' }));

    expect(api.listarLogAuditoria).toHaveBeenLastCalledWith({
      usuarioId: BRUNO.id,
      acao: 'ACESSO_LIBERADO',
      associado: 'exemplo',
      de: '2026-10-01',
      ate: '2026-10-28',
    });
  });

  it('lê os filtros do endereço e ignora os valores inválidos', async () => {
    abrir(
      `/admin/auditoria?usuarioId=${ANA.id}&acao=OUTRA&associado=exemplo&de=2026-10-01&ate=ontem&pagina=2`,
    );
    await screen.findByText('Nenhuma ação encontrada.');
    await screen.findByRole('option', { name: 'Ana' });

    expect(api.listarLogAuditoria).toHaveBeenCalledWith({
      usuarioId: ANA.id,
      associado: 'exemplo',
      de: '2026-10-01',
      pagina: 2,
    });
    expect(screen.getByLabelText('Quem fez')).toHaveValue(ANA.id);
    expect(screen.getByLabelText('Ação')).toHaveValue('');
    expect(screen.getByLabelText('De')).toHaveValue('2026-10-01');
  });

  it('passa de página', async () => {
    vi.mocked(api.listarLogAuditoria).mockResolvedValue(
      lista({ total: 45, itens: [item({})] }),
    );
    abrir();

    expect(await screen.findByText('Página 1 de 3')).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Próxima página' }),
    );

    expect(api.listarLogAuditoria).toHaveBeenLastCalledWith({ pagina: 2 });
  });

  it('avisa quando a API não responde', async () => {
    vi.mocked(api.listarLogAuditoria).mockRejectedValue(
      new TypeError('Failed to fetch'),
    );
    abrir();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar o histórico agora.',
    );
  });
});
