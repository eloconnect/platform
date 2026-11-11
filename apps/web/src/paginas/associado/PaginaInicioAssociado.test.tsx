import type { ApiClient } from '@eloconnect/shared';
import { ApiError } from '@eloconnect/shared';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../api';
import { PaginaInicioAssociado } from './PaginaInicioAssociado';

vi.mock('../../api', () => ({
  api: {
    minhaConta: vi.fn<ApiClient['minhaConta']>(),
    listarMeusBoletos: vi.fn<ApiClient['listarMeusBoletos']>(),
  },
}));

const boleto = {
  id: 'boleto-01',
  competencia: { ano: 2099, mes: 12 },
  valor: '100.00',
  vencimento: '2099-12-10',
  validoAte: '2100-01-09',
  vencido: false,
  linhaDigitavel: '00000.00000 00000.000000 00000.000000 0 00000000000000',
  pixCopiaECola: '00020126-pix-ficticio',
};

const contaEmDia = {
  nome: 'Drogaria Exemplo',
  situacao: 'Adimplente' as const,
  acessoLiberadoAte: null,
  recebeBoletoMensal: true,
  cancelamentoPedidoEm: null,
};

function abrir(state?: unknown) {
  render(
    <MemoryRouter initialEntries={[{ pathname: '/associado', state }]}>
      <PaginaInicioAssociado />
    </MemoryRouter>,
  );
}

describe('PaginaInicioAssociado', () => {
  beforeEach(() => {
    vi.mocked(api.minhaConta).mockReset();
    vi.mocked(api.listarMeusBoletos).mockReset();
    vi.mocked(api.listarMeusBoletos).mockResolvedValue([]);
  });

  it('mostra o boleto em aberto com o valor, o vencimento e o caminho para pagar (RF12)', async () => {
    vi.mocked(api.minhaConta).mockResolvedValue(contaEmDia);
    vi.mocked(api.listarMeusBoletos).mockResolvedValue([boleto]);
    abrir();

    expect(
      await screen.findByRole('heading', {
        name: 'Boleto de dezembro de 2099',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('R$ 100,00')).toBeInTheDocument();
    expect(screen.getByText('10/12/2099')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Ver meu boleto' }),
    ).toHaveAttribute('href', '/associado/boletos');
  });

  it('com o boleto vencido, mostra o mais antigo e até quando dá para pagar (RN03)', async () => {
    vi.mocked(api.minhaConta).mockResolvedValue(contaEmDia);
    vi.mocked(api.listarMeusBoletos).mockResolvedValue([
      boleto,
      {
        ...boleto,
        id: 'boleto-00',
        competencia: { ano: 2099, mes: 11 },
        vencimento: '2099-11-10',
        validoAte: '2099-12-10',
        vencido: true,
      },
    ]);
    abrir();

    expect(
      await screen.findByRole('heading', {
        name: 'O boleto de novembro de 2099 venceu em 10/11/2099',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Você ainda pode pagar este boleto até/),
    ).toHaveTextContent('10/12/2099');
    expect(
      screen.getByText('Há mais 1 boleto em aberto na página de boletos.'),
    ).toBeInTheDocument();
  });

  it('em dia e sem boleto em aberto, diz que não há nada para pagar', async () => {
    vi.mocked(api.minhaConta).mockResolvedValue(contaEmDia);
    abrir();

    expect(
      await screen.findByRole('heading', {
        name: 'Nenhum boleto para pagar agora',
      }),
    ).toBeInTheDocument();
  });

  it('serve de menu, com as áreas do site em cartões', async () => {
    vi.mocked(api.minhaConta).mockResolvedValue(contaEmDia);
    abrir();

    await screen.findByText('Drogaria Exemplo');
    for (const [nome, endereco] of [
      [/Meus boletos/, '/associado/boletos'],
      [/Histórico de pagamentos/, '/associado/historico'],
      [/Notícias/, '/associado/noticias'],
      [/Convenções/, '/associado/convencoes'],
    ] as const) {
      expect(screen.getByRole('link', { name: nome })).toHaveAttribute(
        'href',
        endereco,
      );
    }
  });

  it('sem conseguir conferir os boletos, indica a página de boletos', async () => {
    vi.mocked(api.minhaConta).mockResolvedValue(contaEmDia);
    vi.mocked(api.listarMeusBoletos).mockRejectedValue(
      new ApiError(500, 'erro'),
    );
    abrir();

    expect(
      await screen.findByRole('link', { name: 'Abrir a página de boletos' }),
    ).toHaveAttribute('href', '/associado/boletos');
  });

  it('mostra a situação, sem aviso quando não há liberação', async () => {
    vi.mocked(api.minhaConta).mockResolvedValue({
      nome: 'Drogaria Exemplo',
      situacao: 'Sem contribuição ativa',
      acessoLiberadoAte: null,
      recebeBoletoMensal: false,
      cancelamentoPedidoEm: null,
    });
    abrir();

    expect(await screen.findByText('Drogaria Exemplo')).toBeInTheDocument();
    expect(
      screen.getByText('Situação: Sem contribuição ativa'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /Acesso liberado/ }),
    ).not.toBeInTheDocument();
    // Quem não recebe o boleto vê o convite para aderir (RN23).
    expect(
      screen.getByRole('link', { name: 'Quero receber o boleto todo mês' }),
    ).toHaveAttribute('href', '/associado/adesao');
  });

  it('com a liberação da sede em vigor, avisa até quando ela vale (RN11)', async () => {
    vi.mocked(api.minhaConta).mockResolvedValue({
      nome: 'Drogaria Exemplo',
      situacao: 'Inadimplente',
      acessoLiberadoAte: '2026-11-04T12:00:00.000Z',
      recebeBoletoMensal: true,
      cancelamentoPedidoEm: null,
    });
    abrir();

    expect(
      await screen.findByRole('heading', {
        name: 'Acesso liberado pela sede até 04/11/2026',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/o acesso volta a depender do pagamento em dia/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Quero receber o boleto todo mês' }),
    ).not.toBeInTheDocument();
  });

  it('quem recebe o boleto vê o caminho para cancelar (RF26)', async () => {
    vi.mocked(api.minhaConta).mockResolvedValue({
      nome: 'Drogaria Exemplo',
      situacao: 'Adimplente',
      acessoLiberadoAte: null,
      recebeBoletoMensal: true,
      cancelamentoPedidoEm: null,
    });
    abrir();

    expect(
      await screen.findByRole('link', { name: 'Cancelar o boleto mensal' }),
    ).toHaveAttribute('href', '/associado/cancelamento');
    expect(
      screen.getByText('A farmácia recebe o boleto da contribuição todo mês.'),
    ).toBeInTheDocument();
  });

  it('com o pedido de cancelamento enviado, mostra o prazo da sede (RN18)', async () => {
    vi.mocked(api.minhaConta).mockResolvedValue({
      nome: 'Drogaria Exemplo',
      situacao: 'Adimplente',
      acessoLiberadoAte: null,
      recebeBoletoMensal: true,
      cancelamentoPedidoEm: '2026-11-02T15:00:00.000Z',
    });
    abrir({ aviso: 'Pedido de cancelamento enviado.' });

    expect(
      await screen.findByText(
        /O cancelamento do boleto mensal foi pedido em 02\/11\/2026\. A sede do sindicato tem 15 dias para responder\./,
      ),
    ).toBeInTheDocument();
    // Depois de carregar, o único aviso é o do pedido enviado.
    expect(screen.getByRole('status')).toHaveTextContent(
      'Pedido de cancelamento enviado.',
    );
    expect(
      screen.queryByRole('link', { name: 'Cancelar o boleto mensal' }),
    ).not.toBeInTheDocument();
  });

  it('avisa quando a API não responde', async () => {
    vi.mocked(api.minhaConta).mockRejectedValue(new ApiError(500, 'erro'));
    abrir();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar os seus dados agora.',
    );
  });
});
