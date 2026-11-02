import type { ApiClient } from '@eloconnect/shared';
import { ApiError } from '@eloconnect/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../api';
import { PaginaImportarAssociados } from './PaginaImportarAssociados';

vi.mock('../../api', () => ({
  api: { importarAssociados: vi.fn<ApiClient['importarAssociados']>() },
}));

function abrir() {
  render(
    <MemoryRouter>
      <PaginaImportarAssociados />
    </MemoryRouter>,
  );
}

const PLANILHA = new File(['CNPJ;Razão social'], 'associados.csv', {
  type: 'text/csv',
});

async function enviarPlanilha() {
  await userEvent.upload(screen.getByLabelText(/^Planilha \(CSV\)/), PLANILHA);
  await userEvent.click(screen.getByRole('button', { name: 'Importar' }));
}

describe('PaginaImportarAssociados', () => {
  beforeEach(() => {
    vi.mocked(api.importarAssociados).mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('baixa a planilha modelo, só com o cabeçalho', async () => {
    let conteudo: Blob | undefined;
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn<typeof URL.createObjectURL>((arquivo) => {
        conteudo = arquivo as Blob;
        return 'blob:x';
      }),
      revokeObjectURL: vi.fn<typeof URL.revokeObjectURL>(),
    });
    const baixados: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      baixados.push(this.download);
    });
    abrir();

    await userEvent.click(
      screen.getByRole('button', { name: 'Baixar a planilha modelo' }),
    );

    expect(baixados).toEqual(['planilha-modelo-associados.csv']);
    // Começa com o BOM, que o Excel usa para ler os acentos.
    const bytes = new Uint8Array((await conteudo?.arrayBuffer()) ?? []);
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(await conteudo?.text()).toBe(
      'CNPJ;Razão social;Nome fantasia;E-mail;Telefone;Município;Recebe boleto mensal\r\n',
    );
  });

  it('pede a planilha antes de importar', async () => {
    abrir();

    await userEvent.click(screen.getByRole('button', { name: 'Importar' }));

    expect(screen.getByText('Escolha a planilha.')).toBeInTheDocument();
    expect(api.importarAssociados).not.toHaveBeenCalled();
  });

  it('importa e diz quantos entraram e quantos recebem o boleto', async () => {
    vi.mocked(api.importarAssociados).mockResolvedValue({
      importados: 2,
      recebemBoleto: 1,
      erros: [],
    });
    abrir();

    await enviarPlanilha();

    expect(api.importarAssociados).toHaveBeenCalledWith(PLANILHA);
    expect(await screen.findByRole('status')).toHaveTextContent(
      '2 associados importados. 1 recebe o boleto mensal.',
    );
  });

  it('com erro na planilha, mostra cada linha para corrigir', async () => {
    vi.mocked(api.importarAssociados).mockResolvedValue({
      importados: 0,
      recebemBoleto: 0,
      erros: [
        { linha: 3, mensagem: 'CNPJ inválido.' },
        { linha: 5, mensagem: 'Este CNPJ já está no cadastro.' },
      ],
    });
    abrir();

    await enviarPlanilha();

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent(
      'A planilha tem erros, e nada foi importado.',
    );
    expect(alerta).toHaveTextContent('Linha 3: CNPJ inválido.');
    expect(alerta).toHaveTextContent('Linha 5: Este CNPJ já está no cadastro.');
  });

  it('mostra o motivo quando a API recusa', async () => {
    vi.mocked(api.importarAssociados).mockRejectedValue(
      new ApiError(
        409,
        'Um CNPJ da planilha entrou no cadastro enquanto isso. Envie a planilha de novo.',
      ),
    );
    abrir();

    await enviarPlanilha();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Um CNPJ da planilha entrou no cadastro enquanto isso.',
    );
  });
});
