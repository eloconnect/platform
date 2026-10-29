import type { ApiClient } from '@eloconnect/shared';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../api';
import { PaginaInicial } from './PaginaInicial';

vi.mock('../../api', () => ({
  api: {
    listarBeneficios: vi.fn<ApiClient['listarBeneficios']>(),
  },
}));

function abrir() {
  render(
    <MemoryRouter>
      <PaginaInicial />
    </MemoryRouter>,
  );
}

function aviso(): HTMLElement {
  const elemento = screen
    .getByRole('heading', {
      name: 'Sua farmácia ainda não está no cadastro do sindicato?',
    })
    .closest('aside');
  if (!elemento) throw new Error('Aviso de pedido de cadastro não encontrado.');
  return elemento;
}

function secaoBeneficios(): HTMLElement {
  return screen.getByRole('region', { name: 'Benefícios e serviços' });
}

describe('PaginaInicial', () => {
  beforeEach(() => {
    vi.mocked(api.listarBeneficios).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('mostra os benefícios cadastrados pela sede, por grupo (RF24)', async () => {
    vi.mocked(api.listarBeneficios).mockResolvedValue([
      {
        id: 'beneficio-01',
        titulo: 'Consultoria fiscal',
        descricao: 'Descrição fictícia.',
        grupo: 'CONSULTORIA',
      },
      {
        id: 'beneficio-02',
        titulo: 'Assessoria trabalhista',
        descricao: 'Descrição fictícia.',
        grupo: 'ASSESSORIA_JURIDICA',
      },
    ]);
    abrir();

    const secao = secaoBeneficios();
    const titulos = await within(secao).findAllByRole('heading', { level: 3 });
    expect(titulos.map((titulo) => titulo.textContent)).toEqual([
      'Assessoria jurídica',
      'Consultoria',
    ]);
    expect(
      within(secao).getByRole('heading', {
        level: 4,
        name: 'Assessoria trabalhista',
      }),
    ).toBeInTheDocument();
  });

  it('avisa quando ainda não há benefícios cadastrados', async () => {
    abrir();

    expect(
      await within(secaoBeneficios()).findByText(
        'Os benefícios do sindicato aparecem aqui assim que forem cadastrados.',
      ),
    ).toBeInTheDocument();
  });

  it('avisa quando não consegue carregar os benefícios', async () => {
    vi.mocked(api.listarBeneficios).mockRejectedValue(
      new TypeError('Failed to fetch'),
    );
    abrir();

    expect(
      await within(secaoBeneficios()).findByText(
        /Não foi possível carregar os benefícios agora\./,
      ),
    ).toBeInTheDocument();
  });

  it('mostra o e-mail para pedir o cadastro, quando configurado', () => {
    vi.stubEnv('VITE_EMAIL_PEDIDO_CADASTRO', 'cadastro@example.com');
    abrir();

    expect(
      screen.getByRole('link', { name: 'cadastro@example.com' }),
    ).toHaveAttribute('href', 'mailto:cadastro@example.com');
    expect(aviso()).toHaveTextContent(
      'Depois do cadastro, é só criar a conta com o CNPJ da farmácia.',
    );
  });

  it('sem o e-mail configurado, orienta a falar com a sede', () => {
    vi.stubEnv('VITE_EMAIL_PEDIDO_CADASTRO', '');
    abrir();

    expect(aviso()).toHaveTextContent('Peça o cadastro à sede do sindicato.');
  });
});
