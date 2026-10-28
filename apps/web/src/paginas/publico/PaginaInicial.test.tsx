import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PaginaInicial } from './PaginaInicial';

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

describe('PaginaInicial', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
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
