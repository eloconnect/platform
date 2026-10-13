import { Button, Form } from 'react-bootstrap';
import { Link } from 'react-router';
import { MarcaElo, useTituloPagina } from '../../componentes';

export function PaginaConfirmarCadastro() {
  useTituloPagina('Confirmar cadastro');

  return (
    <section className="cartao-pagina cartao-autenticacao cartao-confirmacao">
      <MarcaElo />
      <span className="pagina-selo">
        Ambiente seguro · Sindicato das Farmácias
      </span>
      <h1>Confirme os dados da farmácia</h1>
      <p className="pagina-descricao">
        Para validar a empresa, informe os cinco dígitos centrais do CNPJ e o
        e-mail para receber as instruções de acesso.
      </p>

      <Form
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <div className="etapa-confirmacao">
          <span className="etapa-numero" aria-hidden="true">
            1
          </span>
          <div>
            <h2>Verificação do CNPJ</h2>
            <p>Digite os cinco dígitos centrais do CNPJ da farmácia.</p>
          </div>
          <Form.Group controlId="digitos-cnpj">
            <Form.Label>
              Cinco dígitos do CNPJ <span className="text-danger">*</span>
            </Form.Label>
            <Form.Control
              className="campo-codigo"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              maxLength={5}
              pattern="[0-9]{5}"
              placeholder="00000"
              required
              size="lg"
            />
            <Form.Text>
              Informe os cinco dígitos indicados para validar o CNPJ.
            </Form.Text>
          </Form.Group>
        </div>

        <div className="etapa-confirmacao">
          <span className="etapa-numero" aria-hidden="true">
            2
          </span>
          <div>
            <h2>Endereço para contato</h2>
            <p>Informe o e-mail corporativo para receber as instruções.</p>
          </div>
          <Form.Group controlId="email-confirmacao">
            <Form.Label>
              E-mail da farmácia <span className="text-danger">*</span>
            </Form.Label>
            <Form.Control
              type="email"
              autoComplete="email"
              placeholder="exemplo@farmacia.com.br"
              required
              size="lg"
            />
          </Form.Group>
        </div>

        <Button
          className="w-100"
          type="submit"
          size="lg"
          disabled
          aria-describedby="confirmacao-indisponivel"
        >
          Confirmar dados e continuar
        </Button>
        <p id="confirmacao-indisponivel" className="nota-indisponibilidade">
          A validação e o envio de instruções ainda não estão conectados ao
          serviço de cadastro.
        </p>
      </Form>
      <Link className="link-voltar-cadastro" to="/cadastro">
        Voltar ao cadastro da farmácia
      </Link>
    </section>
  );
}
