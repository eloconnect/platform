import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AvisoSucesso, Botao, CampoTexto, MensagemErro } from '.';

describe('CampoTexto', () => {
  it('liga o rótulo visível ao campo', () => {
    render(<CampoTexto rotulo="E-mail" type="email" />);
    expect(screen.getByLabelText('E-mail')).toHaveAttribute('type', 'email');
  });

  it('marca obrigatório no rótulo e no campo', () => {
    render(<CampoTexto rotulo="Senha" obrigatorio />);
    const campo = screen.getByLabelText(/Senha/);
    expect(campo).toBeRequired();
    expect(screen.getByText('(obrigatório)')).toBeInTheDocument();
  });

  it('liga a ajuda e o erro ao campo para leitores de tela', () => {
    render(
      <CampoTexto rotulo="CNPJ" ajuda="Só os números" erro="CNPJ inválido" />,
    );
    const campo = screen.getByLabelText('CNPJ');
    expect(campo).toHaveAttribute('aria-invalid', 'true');
    expect(campo).toHaveAccessibleDescription('Só os números CNPJ inválido');
  });

  it('vira caixa de texto de várias linhas com "linhas"', () => {
    render(<CampoTexto rotulo="Descrição" linhas={4} />);
    const campo = screen.getByLabelText('Descrição');
    expect(campo.tagName).toBe('TEXTAREA');
    expect(campo).toHaveAttribute('rows', '4');
  });
});

describe('Botao', () => {
  it('é grande por padrão', () => {
    render(<Botao>Enviar</Botao>);
    expect(screen.getByRole('button', { name: 'Enviar' })).toHaveClass(
      'btn-lg',
    );
  });
});

describe('Mensagens', () => {
  it('erro é anunciado como alerta', () => {
    render(<MensagemErro>Algo deu errado</MensagemErro>);
    expect(screen.getByRole('alert')).toHaveTextContent('Algo deu errado');
  });

  it('sucesso é anunciado como status', () => {
    render(<AvisoSucesso>Salvo</AvisoSucesso>);
    expect(screen.getByRole('status')).toHaveTextContent('Salvo');
  });
});
