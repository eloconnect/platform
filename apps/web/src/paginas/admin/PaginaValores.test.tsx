import type {
  ApiClient,
  PainelValores,
  ValorContribuicao,
} from '@eloconnect/shared';
import { ApiError } from '@eloconnect/shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../api';
import { entrarComo } from '../../test/sessao';
import { PaginaValores } from './PaginaValores';

vi.mock('../../api', () => ({
  api: {
    painelValores: vi.fn<ApiClient['painelValores']>(),
    alterarValor: vi.fn<ApiClient['alterarValor']>(),
  },
}));

const VALOR_120: ValorContribuicao = {
  id: 'valor-01',
  valorMensal: '120.00',
  valorAnual: '1152.00',
  alteradoEm: '2026-09-15T15:00:00.000Z',
  alteradoPor: { nome: 'Ana' },
};

const VALOR_130: ValorContribuicao = {
  id: 'valor-02',
  valorMensal: '130.00',
  valorAnual: '1248.00',
  alteradoEm: '2026-10-28T15:00:00.000Z',
  alteradoPor: { nome: 'Bruno' },
};

function painel(dados: Partial<PainelValores>): PainelValores {
  return {
    atual: VALOR_120,
    historico: [VALOR_120],
    associadosAvisados: 3,
    ...dados,
  };
}

async function abrir() {
  render(<PaginaValores />);
  await screen.findByRole('heading', { level: 2, name: 'Valor atual' });
}

describe('PaginaValores', () => {
  beforeEach(() => {
    entrarComo('ADMIN');
    // Só a data é falsa, para o mês do novo valor não depender do dia do teste.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-28T15:00:00.000Z'));
    vi.mocked(api.painelValores).mockReset();
    vi.mocked(api.alterarValor).mockReset();
    vi.mocked(api.painelValores).mockResolvedValue(painel({}));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('mostra o valor atual e o histórico, com o valor anterior', async () => {
    vi.mocked(api.painelValores).mockResolvedValue(
      painel({ atual: VALOR_130, historico: [VALOR_130, VALOR_120] }),
    );
    await abrir();

    expect(screen.getByText('R$ 130,00 por mês')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Plano anual à vista: R$ 1.248,00, com 20% de desconto.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Alterado em 28/10/2026 por Bruno. Vale a partir do boleto de novembro de 2026.',
      ),
    ).toBeInTheDocument();

    const [, ultima, primeira] = screen.getAllByRole('row');
    expect(ultima).toHaveTextContent('28/10/2026');
    expect(ultima).toHaveTextContent('Bruno');
    expect(ultima).toHaveTextContent('R$ 120,00');
    expect(ultima).toHaveTextContent('R$ 130,00');
    expect(ultima).toHaveTextContent('R$ 1.248,00');
    expect(ultima).toHaveTextContent('novembro de 2026');
    expect(primeira).toHaveTextContent('15/09/2026');
    expect(primeira).toHaveTextContent('—');
    expect(primeira).toHaveTextContent('outubro de 2026');
  });

  it('avisa quando ainda não há valor cadastrado', async () => {
    vi.mocked(api.painelValores).mockResolvedValue(
      painel({ atual: null, historico: [] }),
    );
    await abrir();

    expect(
      screen.getByText('Nenhum valor cadastrado ainda.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Nenhuma alteração ainda.')).toBeInTheDocument();
  });

  it('mostra o plano anual calculado enquanto a sede digita', async () => {
    await abrir();

    await userEvent.type(screen.getByLabelText('Novo valor mensal'), '130,5');

    expect(
      screen.getByText('Plano anual à vista com este valor: R$ 1.252,80.'),
    ).toBeInTheDocument();
  });

  it.each([
    ['abc', 'Digite o valor em reais, por exemplo 130,00.'],
    ['0', 'O valor precisa ser maior que zero.'],
    ['120', 'Este já é o valor atual.'],
  ])('não continua com "%s"', async (texto, mensagem) => {
    await abrir();

    await userEvent.type(screen.getByLabelText('Novo valor mensal'), texto);
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(screen.getByText(mensagem)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('confirma mostrando o antes e o depois, o mês e quem recebe o aviso', async () => {
    vi.mocked(api.alterarValor).mockResolvedValue(
      painel({ atual: VALOR_130, historico: [VALOR_130, VALOR_120] }),
    );
    await abrir();

    await userEvent.type(screen.getByLabelText('Novo valor mensal'), '130');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    const janela = await screen.findByRole('dialog', {
      name: 'Confirmar o novo valor?',
    });
    expect(janela).toHaveTextContent('Valor mensal: R$ 120,00 → R$ 130,00');
    expect(janela).toHaveTextContent(
      'Plano anual à vista: R$ 1.152,00 → R$ 1.248,00',
    );
    expect(janela).toHaveTextContent(
      'Vale a partir do boleto de novembro de 2026.',
    );
    expect(janela).toHaveTextContent(
      'Os 3 associados que recebem o boleto mensal vão receber agora um e-mail com o aviso.',
    );
    expect(api.alterarValor).not.toHaveBeenCalled();

    await userEvent.click(
      within(janela).getByRole('button', { name: 'Sim, alterar o valor' }),
    );

    expect(api.alterarValor).toHaveBeenCalledWith({ valorMensal: '130.00' });
    expect(await screen.findByRole('status')).toHaveTextContent(
      'O novo valor foi salvo. O aviso por e-mail está indo para 3 associados.',
    );
    expect(screen.getByText('R$ 130,00 por mês')).toBeInTheDocument();
    expect(screen.getByLabelText('Novo valor mensal')).toHaveValue('');
  });

  it('volta ao campo quando a API recusa o valor', async () => {
    vi.mocked(api.alterarValor).mockRejectedValue(
      new ApiError(400, 'recusado', 'valorMensal'),
    );
    await abrir();

    await userEvent.type(screen.getByLabelText('Novo valor mensal'), '130');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await userEvent.click(
      await screen.findByRole('button', { name: 'Sim, alterar o valor' }),
    );

    expect(
      await screen.findByText(
        'Confira o valor: ele precisa ser maior que zero e diferente do atual.',
      ),
    ).toBeInTheDocument();
  });

  it('avisa na janela quando a API não responde', async () => {
    vi.mocked(api.alterarValor).mockRejectedValue(
      new TypeError('Failed to fetch'),
    );
    await abrir();

    await userEvent.type(screen.getByLabelText('Novo valor mensal'), '130');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await userEvent.click(
      await screen.findByRole('button', { name: 'Sim, alterar o valor' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível salvar o valor agora.',
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('avisa quando não consegue carregar os valores', async () => {
    vi.mocked(api.painelValores).mockRejectedValue(
      new TypeError('Failed to fetch'),
    );
    render(<PaginaValores />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar os valores agora.',
    );
  });
});
