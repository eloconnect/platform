import type {
  ApiClient,
  AssociadoDetalhe,
  BoletoHistorico,
  ProximoBoleto,
} from '@eloconnect/shared';
import { ApiError } from '@eloconnect/shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../api';
import { entrarComo } from '../../test/sessao';
import { PaginaPerfilAssociado } from './PaginaPerfilAssociado';

vi.mock('../../api', () => ({
  api: {
    buscarAssociado: vi.fn<ApiClient['buscarAssociado']>(),
    inativarAssociado: vi.fn<ApiClient['inativarAssociado']>(),
    reativarAssociado: vi.fn<ApiClient['reativarAssociado']>(),
    definirAcesso: vi.fn<ApiClient['definirAcesso']>(),
    editarProximoBoleto: vi.fn<ApiClient['editarProximoBoleto']>(),
    voltarAoValorNormal: vi.fn<ApiClient['voltarAoValorNormal']>(),
    listarBoletosAssociado: vi.fn<ApiClient['listarBoletosAssociado']>(),
    simularPagamento: vi.fn<ApiClient['simularPagamento']>(),
  },
}));

const PROXIMO: ProximoBoleto = {
  competencia: { ano: 2026, mes: 12 },
  valorNormal: '120.00',
  valorEditado: null,
};
const PROXIMO_EDITADO: ProximoBoleto = { ...PROXIMO, valorEditado: '100.00' };

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
    acessoManualAte: null,
    inativadoEm: null,
    criadoEm: '2026-10-01T12:00:00.000Z',
    atualizadoEm: '2026-10-01T12:00:00.000Z',
    cancelamentos: [],
    conta: null,
    proximoBoleto: null,
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

/**
 * Seção do perfil já carregado. Espere antes pela seção "Situação": o título
 * da página aparece ainda durante o carregamento.
 */
function secao(titulo: string): HTMLElement {
  const elemento = screen
    .getByRole('heading', { level: 2, name: titulo })
    .closest('section');
  if (!elemento) throw new Error(`Seção "${titulo}" não encontrada.`);
  return elemento;
}

const boleto = (
  dados: Partial<BoletoHistorico> & Pick<BoletoHistorico, 'id' | 'status'>,
): BoletoHistorico => ({
  competencia: { ano: 2026, mes: 11 },
  tipo: 'MENSAL',
  valor: '120.00',
  vencimento: '2026-11-10',
  vencido: false,
  pagoEm: null,
  formaPagamento: null,
  ...dados,
});
const BOLETOS: BoletoHistorico[] = [
  boleto({
    id: 'b-12',
    status: 'RASCUNHO',
    competencia: { ano: 2026, mes: 12 },
    vencimento: '2026-12-10',
  }),
  boleto({ id: 'b-11', status: 'EM_ABERTO', vencido: true }),
  boleto({
    id: 'b-10',
    status: 'PAGO',
    competencia: { ano: 2026, mes: 10 },
    vencimento: '2026-10-10',
    pagoEm: '2026-10-08T15:00:00.000Z',
    formaPagamento: 'PIX',
  }),
  boleto({
    id: 'b-09',
    status: 'EXPIRADO',
    tipo: 'AVULSO',
    competencia: { ano: 2026, mes: 9 },
    vencimento: '2026-09-10',
  }),
];
const linhas = async () => {
  await screen.findByRole('heading', { level: 2, name: 'Situação' });
  const historico = secao('Histórico de boletos e pagamentos');
  return (await within(historico).findAllByRole('row')).slice(1);
};

describe('PaginaPerfilAssociado', () => {
  beforeEach(() => {
    entrarComo('ADMIN');
    vi.mocked(api.buscarAssociado).mockReset();
    vi.mocked(api.inativarAssociado).mockReset();
    vi.mocked(api.reativarAssociado).mockReset();
    vi.mocked(api.definirAcesso).mockReset();
    vi.mocked(api.editarProximoBoleto).mockReset();
    vi.mocked(api.voltarAoValorNormal).mockReset();
    vi.mocked(api.listarBoletosAssociado).mockResolvedValue({
      boletos: [],
      simulacao: false,
    });
    vi.mocked(api.simularPagamento).mockReset();
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
    expect(
      await within(secao('Histórico de boletos e pagamentos')).findByText(
        'Nenhum boleto ainda.',
      ),
    ).toBeInTheDocument();
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

    await screen.findByRole('heading', { level: 2, name: 'Situação' });
    expect(secao('Conta de acesso')).toHaveTextContent(texto);
  });

  it('o perfil básico da sede vê o perfil sem os botões de alterar (RN33)', async () => {
    entrarComo('ADMIN_BASICO');
    vi.mocked(api.buscarAssociado).mockResolvedValue(
      associado({ proximoBoleto: PROXIMO_EDITADO }),
    );
    abrir();

    await screen.findByRole('heading', { level: 2, name: 'Situação' });
    expect(secao('Acesso a benefícios e suporte')).toHaveTextContent(
      'Segue o pagamento. Hoje está liberado.',
    );
    expect(secao('Próximo boleto')).toHaveTextContent(
      'Boleto de dezembro de 2026: R$ 100,00',
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Editar dados' }),
    ).not.toBeInTheDocument();
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

    await screen.findByRole('heading', { level: 2, name: 'Situação' });
    const situacao = secao('Situação');
    for (const texto of [
      'Sem contribuição ativa',
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
    // O histórico de boletos também tem um aviso de carregamento.
    expect(
      screen
        .getAllByRole('status')
        .some((aviso) => aviso.textContent === 'Dados salvos.'),
    ).toBe(true);
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

  describe('acesso a benefícios e suporte (RF09)', () => {
    it.each([
      [
        'segue o pagamento',
        { acessoManual: null, situacao: 'INADIMPLENTE' },
        'Segue o pagamento. Hoje está bloqueado.',
        ['Bloquear acesso', 'Liberar acesso'],
      ],
      [
        'bloqueado pela sede',
        { acessoManual: 'BLOQUEADO' },
        'Bloqueado pela sede, mesmo que o pagamento esteja em dia.',
        ['Liberar acesso', 'Voltar a seguir o pagamento'],
      ],
      [
        'liberado pela sede',
        {
          acessoManual: 'LIBERADO',
          acessoManualAte: '2099-11-04T12:00:00.000Z',
        },
        'Liberado pela sede até 04/11/2099, mesmo que o pagamento esteja em atraso. Depois, volta a seguir o pagamento.',
        ['Bloquear acesso', 'Voltar a seguir o pagamento'],
      ],
      [
        'com a liberação vencida, que volta a seguir o pagamento',
        {
          acessoManual: 'LIBERADO',
          acessoManualAte: '2026-10-01T12:00:00.000Z',
          situacao: 'INADIMPLENTE',
        },
        'Segue o pagamento. Hoje está bloqueado.',
        ['Bloquear acesso', 'Liberar acesso'],
      ],
    ] as const)(
      'mostra o acesso %s e as outras opções',
      async (_caso, dados, texto, botoes) => {
        vi.mocked(api.buscarAssociado).mockResolvedValue(associado(dados));
        abrir();

        await screen.findByRole('heading', { level: 2, name: 'Situação' });
        const acesso = secao('Acesso a benefícios e suporte');
        expect(acesso).toHaveTextContent(texto);
        expect(
          within(acesso)
            .getAllByRole('button')
            .map((botao) => botao.textContent),
        ).toEqual(botoes);
      },
    );

    it('bloqueia com o motivo depois de confirmar', async () => {
      vi.mocked(api.buscarAssociado).mockResolvedValue(associado());
      vi.mocked(api.definirAcesso).mockResolvedValue(
        associado({ acessoManual: 'BLOQUEADO' }),
      );
      abrir();

      await userEvent.click(
        await screen.findByRole('button', { name: 'Bloquear acesso' }),
      );
      const janela = await screen.findByRole('dialog', {
        name: 'Bloquear o acesso?',
      });
      await userEvent.type(
        within(janela).getByLabelText(/^Motivo/),
        ' Motivo fictício ',
      );
      await userEvent.click(
        within(janela).getByRole('button', { name: 'Confirmar' }),
      );

      expect(api.definirAcesso).toHaveBeenCalledWith('id-01', {
        acessoManual: 'BLOQUEADO',
        motivo: 'Motivo fictício',
      });
      expect(await screen.findByText('Acesso bloqueado.')).toBeInTheDocument();
      expect(secao('Acesso a benefícios e suporte')).toHaveTextContent(
        'Bloqueado pela sede',
      );
      expect(secao('Situação')).toHaveTextContent('Acesso bloqueado pela sede');
    });

    it('não envia sem motivo', async () => {
      vi.mocked(api.buscarAssociado).mockResolvedValue(associado());
      abrir();

      await userEvent.click(
        await screen.findByRole('button', { name: 'Liberar acesso' }),
      );
      const janela = await screen.findByRole('dialog', {
        name: 'Liberar o acesso?',
      });
      await userEvent.type(within(janela).getByLabelText(/^Motivo/), '   ');
      await userEvent.click(
        within(janela).getByRole('button', { name: 'Confirmar' }),
      );

      expect(
        within(janela).getByLabelText(/^Motivo/),
      ).toHaveAccessibleDescription(/Escreva o motivo\./);
      expect(api.definirAcesso).not.toHaveBeenCalled();
    });

    it('avisa na janela quando não consegue mudar o acesso', async () => {
      vi.mocked(api.buscarAssociado).mockResolvedValue(associado());
      vi.mocked(api.definirAcesso).mockRejectedValue(new ApiError(500, 'erro'));
      abrir();

      await userEvent.click(
        await screen.findByRole('button', { name: 'Bloquear acesso' }),
      );
      const janela = await screen.findByRole('dialog');
      await userEvent.type(
        within(janela).getByLabelText(/^Motivo/),
        'Motivo fictício',
      );
      await userEvent.click(
        within(janela).getByRole('button', { name: 'Confirmar' }),
      );

      expect(await within(janela).findByRole('alert')).toHaveTextContent(
        'Não foi possível mudar o acesso agora.',
      );
    });
  });

  describe('próximo boleto (RF11)', () => {
    it('mostra o valor normal e o botão para mudar', async () => {
      vi.mocked(api.buscarAssociado).mockResolvedValue(
        associado({ proximoBoleto: PROXIMO }),
      );
      abrir();

      await screen.findByRole('heading', { level: 2, name: 'Situação' });
      const proximo = secao('Próximo boleto');
      expect(proximo).toHaveTextContent(
        'Boleto de dezembro de 2026: R$ 120,00, o valor normal da contribuição.',
      );
      expect(
        within(proximo)
          .getAllByRole('button')
          .map((botao) => botao.textContent),
      ).toEqual(['Mudar o valor']);
    });

    it('mostra o valor mudado pela sede e o botão para voltar ao normal', async () => {
      vi.mocked(api.buscarAssociado).mockResolvedValue(
        associado({ proximoBoleto: PROXIMO_EDITADO }),
      );
      abrir();

      await screen.findByRole('heading', { level: 2, name: 'Situação' });
      const proximo = secao('Próximo boleto');
      expect(proximo).toHaveTextContent(
        'Boleto de dezembro de 2026: R$ 100,00, valor mudado pela sede só para este mês. O valor normal é R$ 120,00.',
      );
      expect(
        within(proximo)
          .getAllByRole('button')
          .map((botao) => botao.textContent),
      ).toEqual(['Mudar o valor', 'Voltar ao valor normal']);
    });

    it.each([
      ['de quem não recebe o boleto mensal', { proximoBoleto: null }],
      [
        'do associado inativado',
        { proximoBoleto: PROXIMO, inativadoEm: '2026-10-20T12:00:00.000Z' },
      ],
    ])('não aparece no perfil %s', async (_caso, dados) => {
      vi.mocked(api.buscarAssociado).mockResolvedValue(associado(dados));
      abrir();

      await screen.findByRole('heading', { level: 2, name: 'Situação' });
      expect(
        screen.queryByRole('heading', { name: 'Próximo boleto' }),
      ).not.toBeInTheDocument();
    });

    it('sem valor cadastrado, manda cadastrar e não mostra botões', async () => {
      vi.mocked(api.buscarAssociado).mockResolvedValue(
        associado({ proximoBoleto: { ...PROXIMO, valorNormal: null } }),
      );
      abrir();

      await screen.findByRole('heading', { level: 2, name: 'Situação' });
      const proximo = secao('Próximo boleto');
      expect(proximo).toHaveTextContent(
        'O valor da contribuição ainda não foi cadastrado.',
      );
      expect(within(proximo).queryByRole('button')).not.toBeInTheDocument();
    });

    it('muda o valor e avisa que o associado recebe o e-mail', async () => {
      vi.mocked(api.buscarAssociado).mockResolvedValue(
        associado({ proximoBoleto: PROXIMO }),
      );
      vi.mocked(api.editarProximoBoleto).mockResolvedValue(PROXIMO_EDITADO);
      abrir();

      await userEvent.click(
        await screen.findByRole('button', { name: 'Mudar o valor' }),
      );
      const janela = await screen.findByRole('dialog', {
        name: 'Mudar o valor do boleto de dezembro de 2026',
      });
      expect(janela).toHaveTextContent(
        'Farmácia Exemplo 01 Ltda recebe agora um e-mail avisando da mudança.',
      );
      await userEvent.type(
        within(janela).getByLabelText(/^Novo valor do boleto/),
        '100',
      );
      await userEvent.click(
        within(janela).getByRole('button', { name: 'Salvar o novo valor' }),
      );

      expect(api.editarProximoBoleto).toHaveBeenCalledWith('id-01', {
        valor: '100.00',
      });
      expect(
        await screen.findByText(
          'Valor do boleto de dezembro de 2026 mudado. O associado vai receber um e-mail com o aviso.',
        ),
      ).toBeInTheDocument();
      expect(secao('Próximo boleto')).toHaveTextContent(
        'R$ 100,00, valor mudado pela sede',
      );
    });

    it.each([
      ['um texto que não é valor', 'cem', 'Digite o valor em reais'],
      ['zero', '0', 'O valor precisa ser maior que zero.'],
      [
        'o valor que o boleto já tem',
        '100,00',
        'O boleto já está com este valor.',
      ],
      [
        'o valor normal',
        '120',
        'Este é o valor normal da contribuição. Para voltar a ele, use "Voltar ao valor normal".',
      ],
    ])('não envia %s', async (_caso, texto, erro) => {
      vi.mocked(api.buscarAssociado).mockResolvedValue(
        associado({ proximoBoleto: PROXIMO_EDITADO }),
      );
      abrir();

      await userEvent.click(
        await screen.findByRole('button', { name: 'Mudar o valor' }),
      );
      const janela = await screen.findByRole('dialog');
      const campo = within(janela).getByLabelText(/^Novo valor do boleto/);
      await userEvent.type(campo, texto);
      await userEvent.click(
        within(janela).getByRole('button', { name: 'Salvar o novo valor' }),
      );

      expect(campo).toHaveAccessibleDescription(new RegExp(erro));
      expect(api.editarProximoBoleto).not.toHaveBeenCalled();
    });

    it('mostra no campo o erro de valor que a API devolve', async () => {
      vi.mocked(api.buscarAssociado).mockResolvedValue(
        associado({ proximoBoleto: PROXIMO }),
      );
      vi.mocked(api.editarProximoBoleto).mockRejectedValue(
        new ApiError(400, 'O boleto já está com este valor.', 'valor'),
      );
      abrir();

      await userEvent.click(
        await screen.findByRole('button', { name: 'Mudar o valor' }),
      );
      const janela = await screen.findByRole('dialog');
      const campo = within(janela).getByLabelText(/^Novo valor do boleto/);
      await userEvent.type(campo, '90');
      await userEvent.click(
        within(janela).getByRole('button', { name: 'Salvar o novo valor' }),
      );

      await vi.waitFor(() =>
        expect(campo).toHaveAccessibleDescription(
          /O boleto já está com este valor\./,
        ),
      );
    });

    it('volta ao valor normal depois de confirmar', async () => {
      vi.mocked(api.buscarAssociado).mockResolvedValue(
        associado({ proximoBoleto: PROXIMO_EDITADO }),
      );
      vi.mocked(api.voltarAoValorNormal).mockResolvedValue(PROXIMO);
      abrir();

      await userEvent.click(
        await screen.findByRole('button', { name: 'Voltar ao valor normal' }),
      );
      const janela = await screen.findByRole('dialog', {
        name: 'Voltar ao valor normal?',
      });
      expect(janela).toHaveTextContent(
        'O boleto de dezembro de 2026 volta para R$ 120,00',
      );
      await userEvent.click(
        within(janela).getByRole('button', {
          name: 'Sim, voltar ao valor normal',
        }),
      );

      expect(api.voltarAoValorNormal).toHaveBeenCalledWith('id-01');
      expect(
        await screen.findByText(
          'O boleto de dezembro de 2026 voltou ao valor normal. O associado vai receber um e-mail com o aviso.',
        ),
      ).toBeInTheDocument();
      expect(secao('Próximo boleto')).toHaveTextContent(
        'R$ 120,00, o valor normal da contribuição.',
      );
    });

    it('avisa quando o associado não tem e-mail para receber o aviso', async () => {
      vi.mocked(api.buscarAssociado).mockResolvedValue(
        associado({ email: null, proximoBoleto: PROXIMO }),
      );
      vi.mocked(api.editarProximoBoleto).mockResolvedValue(PROXIMO_EDITADO);
      abrir();

      await userEvent.click(
        await screen.findByRole('button', { name: 'Mudar o valor' }),
      );
      const janela = await screen.findByRole('dialog');
      expect(janela).toHaveTextContent(
        'Este associado não tem e-mail no cadastro, então não recebe o aviso.',
      );
      await userEvent.type(
        within(janela).getByLabelText(/^Novo valor do boleto/),
        '100',
      );
      await userEvent.click(
        within(janela).getByRole('button', { name: 'Salvar o novo valor' }),
      );

      expect(
        await screen.findByText(
          'Valor do boleto de dezembro de 2026 mudado. O associado não tem e-mail no cadastro, então não recebe aviso.',
        ),
      ).toBeInTheDocument();
    });

    it('avisa na janela quando não consegue mudar o valor', async () => {
      vi.mocked(api.buscarAssociado).mockResolvedValue(
        associado({ proximoBoleto: PROXIMO }),
      );
      vi.mocked(api.editarProximoBoleto).mockRejectedValue(
        new ApiError(500, 'erro'),
      );
      abrir();

      await userEvent.click(
        await screen.findByRole('button', { name: 'Mudar o valor' }),
      );
      const janela = await screen.findByRole('dialog');
      await userEvent.type(
        within(janela).getByLabelText(/^Novo valor do boleto/),
        '90',
      );
      await userEvent.click(
        within(janela).getByRole('button', { name: 'Salvar o novo valor' }),
      );

      expect(await within(janela).findByRole('alert')).toHaveTextContent(
        'Não foi possível mudar o valor agora.',
      );
    });
  });

  describe('histórico de boletos (RF07)', () => {
    it('mostra cada boleto com mês, valor, vencimento e situação', async () => {
      vi.mocked(api.buscarAssociado).mockResolvedValue(associado());
      vi.mocked(api.listarBoletosAssociado).mockResolvedValue({
        boletos: BOLETOS,
        simulacao: false,
      });
      abrir();

      await screen.findByRole('heading', { level: 2, name: 'Situação' });
      const [dezembro, novembro, outubro, setembro] = await linhas();
      expect(api.listarBoletosAssociado).toHaveBeenCalledWith('id-01');
      expect(dezembro).toHaveTextContent('dezembro de 2026');
      expect(dezembro).toHaveTextContent('Em emissão');
      expect(novembro).toHaveTextContent(/R\$\s120,00/);
      expect(novembro).toHaveTextContent('10/11/2026');
      expect(novembro).toHaveTextContent('Vencido');
      expect(outubro).toHaveTextContent('Pago em 08/10/2026, com Pix');
      expect(setembro).toHaveTextContent('setembro de 2026 (avulso)');
      expect(setembro).toHaveTextContent('Expirado, sem pagamento');
      // Sem o banco simulado, não há o que simular.
      expect(
        screen.queryByRole('button', { name: /Simular o pagamento/ }),
      ).not.toBeInTheDocument();
    });

    it('na demonstração, o chave mestre simula o pagamento e o acesso volta', async () => {
      vi.mocked(api.buscarAssociado).mockResolvedValue(
        associado({ situacao: 'INADIMPLENTE' }),
      );
      vi.mocked(api.listarBoletosAssociado).mockResolvedValue({
        boletos: BOLETOS,
        simulacao: true,
      });
      vi.mocked(api.simularPagamento).mockResolvedValue({
        boletoId: 'b-09',
        jaEstavaPago: false,
        desbloqueado: true,
      });
      abrir();

      await linhas();
      // Só os boletos em aberto ou expirados podem ser pagos.
      expect(
        screen
          .getAllByRole('button', { name: /^Simular o pagamento do boleto/ })
          .map((botao) => botao.getAttribute('aria-label')),
      ).toEqual([
        'Simular o pagamento do boleto de novembro de 2026',
        'Simular o pagamento do boleto de setembro de 2026',
      ]);
      await userEvent.click(
        screen.getByRole('button', {
          name: 'Simular o pagamento do boleto de setembro de 2026',
        }),
      );
      const janela = await screen.findByRole('dialog', {
        name: 'Simular o pagamento do boleto de setembro de 2026?',
      });
      await userEvent.click(within(janela).getByLabelText('Boleto'));
      await userEvent.click(
        within(janela).getByRole('button', { name: 'Simular o pagamento' }),
      );

      expect(api.simularPagamento).toHaveBeenCalledWith('b-09', {
        formaPagamento: 'BOLETO',
      });
      expect(
        await screen.findByText(
          'Pagamento do boleto de setembro de 2026 simulado. O acesso a benefícios e suporte foi liberado.',
        ),
      ).toBeInTheDocument();
      expect(secao('Situação')).toHaveTextContent('Adimplente');
      // O histórico é carregado de novo.
      expect(api.listarBoletosAssociado).toHaveBeenCalledTimes(2);
    });

    it('o perfil básico não simula pagamento (RN33)', async () => {
      entrarComo('ADMIN_BASICO');
      vi.mocked(api.buscarAssociado).mockResolvedValue(associado());
      vi.mocked(api.listarBoletosAssociado).mockResolvedValue({
        boletos: BOLETOS,
        simulacao: true,
      });
      abrir();

      expect(await linhas()).toHaveLength(4);
      expect(
        screen.queryByRole('button', { name: /Simular o pagamento/ }),
      ).not.toBeInTheDocument();
    });

    it('avisa quando não consegue carregar os boletos', async () => {
      vi.mocked(api.buscarAssociado).mockResolvedValue(associado());
      vi.mocked(api.listarBoletosAssociado).mockRejectedValue(
        new TypeError('Failed to fetch'),
      );
      abrir();

      expect(
        await within(
          await screen
            .findByRole('heading', {
              level: 2,
              name: 'Histórico de boletos e pagamentos',
            })
            .then((titulo) => titulo.closest('section') ?? document.body),
        ).findByRole('alert'),
      ).toHaveTextContent('Não foi possível carregar os boletos agora.');
    });
  });
});
