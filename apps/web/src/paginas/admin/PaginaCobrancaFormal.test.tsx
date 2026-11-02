import type {
  ApiClient,
  Comunicado,
  PainelComunicados,
} from '@eloconnect/shared';
import { ApiError } from '@eloconnect/shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../api';
import { PaginaCobrancaFormal } from './PaginaCobrancaFormal';

vi.mock('../../api', () => ({
  api: {
    painelComunicados: vi.fn<ApiClient['painelComunicados']>(),
    criarComunicado: vi.fn<ApiClient['criarComunicado']>(),
  },
}));

const CONCLUIDO: Comunicado = {
  id: 'c1',
  assunto: 'Cobrança formal de outubro',
  mensagem: 'Texto da sede.\n\nValor da contribuição: R$ 120,00 por mês.',
  criadoEm: '2026-10-01T12:00:00.000Z',
  criadoPor: { nome: 'Admin de Exemplo' },
  total: 400,
  enviados: 400,
  concluidoEm: '2026-10-03T11:40:00.000Z',
};

const PAINEL: PainelComunicados = {
  destinatarios: 400,
  limiteDiario: 150,
  comunicados: [CONCLUIDO],
};

describe('PaginaCobrancaFormal', () => {
  beforeEach(() => {
    vi.mocked(api.painelComunicados).mockResolvedValue(PAINEL);
    vi.mocked(api.criarComunicado).mockReset();
  });

  it('mostra quem recebe, o limite por dia e quantos e-mails saíram', async () => {
    render(<PaginaCobrancaFormal />);

    expect(
      await screen.findByText(/menos os inativados\. Hoje são 400\./),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Saem até 150 e-mails por dia/),
    ).toBeInTheDocument();
    const item = screen.getByRole('listitem');
    expect(
      within(item).getByRole('heading', { name: 'Cobrança formal de outubro' }),
    ).toBeInTheDocument();
    expect(item).toHaveTextContent(
      'Criado em 01/10/2026 por Admin de Exemplo.',
    );
    expect(item).toHaveTextContent(
      'Enviados: 400 de 400. Envio concluído em 03/10/2026.',
    );
    expect(item).toHaveTextContent('Valor da contribuição: R$ 120,00 por mês.');
  });

  it('pede assunto e texto antes de confirmar', async () => {
    render(<PaginaCobrancaFormal />);

    await userEvent.click(
      await screen.findByRole('button', { name: 'Enviar o comunicado' }),
    );

    expect(screen.getByText('Escreva o assunto.')).toBeInTheDocument();
    expect(
      screen.getByText('Escreva o texto do comunicado.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('confirma com o número de associados e de dias e cria o comunicado', async () => {
    vi.mocked(api.criarComunicado).mockResolvedValue({
      ...CONCLUIDO,
      id: 'c2',
      enviados: 0,
      concluidoEm: null,
    });
    render(<PaginaCobrancaFormal />);

    await userEvent.type(
      await screen.findByLabelText(/^Assunto/),
      'Cobrança formal de novembro',
    );
    await userEvent.type(
      screen.getByLabelText(/^Texto do comunicado/),
      'Texto da sede.',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Enviar o comunicado' }),
    );
    const janela = await screen.findByRole('dialog', {
      name: 'Enviar o comunicado para 400 associados?',
    });
    // 400 e-mails, 150 por dia: 3 dias.
    expect(janela).toHaveTextContent('o envio leva cerca de 3 dias');
    await userEvent.click(
      within(janela).getByRole('button', { name: 'Sim, enviar' }),
    );

    expect(api.criarComunicado).toHaveBeenCalledWith({
      assunto: 'Cobrança formal de novembro',
      texto: 'Texto da sede.',
    });
    expect(
      await screen.findByText(
        'Comunicado criado. O envio começa na próxima execução diária.',
      ),
    ).toBeInTheDocument();
    expect(api.painelComunicados).toHaveBeenCalledTimes(2);
  });

  it('mostra o motivo quando a API recusa', async () => {
    vi.mocked(api.criarComunicado).mockRejectedValue(
      new ApiError(400, 'A sede ainda não cadastrou o valor da contribuição.'),
    );
    render(<PaginaCobrancaFormal />);

    await userEvent.type(await screen.findByLabelText(/^Assunto/), 'Assunto');
    await userEvent.type(
      screen.getByLabelText(/^Texto do comunicado/),
      'Texto.',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Enviar o comunicado' }),
    );
    const janela = await screen.findByRole('dialog');
    await userEvent.click(
      within(janela).getByRole('button', { name: 'Sim, enviar' }),
    );

    expect(await within(janela).findByRole('alert')).toHaveTextContent(
      'A sede ainda não cadastrou o valor da contribuição.',
    );
  });

  it('com um envio em andamento, não deixa mandar outro', async () => {
    vi.mocked(api.painelComunicados).mockResolvedValue({
      ...PAINEL,
      comunicados: [{ ...CONCLUIDO, enviados: 150, concluidoEm: null }],
    });
    render(<PaginaCobrancaFormal />);

    expect(
      await screen.findByText(
        'Espere o envio do comunicado atual terminar para mandar outro.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Enviar o comunicado' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('listitem')).toHaveTextContent(
      'Enviados: 150 de 400. Enviando.',
    );
  });

  it('avisa quando a página não carrega', async () => {
    vi.mocked(api.painelComunicados).mockRejectedValue(new Error('falhou'));
    render(<PaginaCobrancaFormal />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar a cobrança formal agora.',
    );
  });
});
