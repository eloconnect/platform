import { Button, Form } from 'react-bootstrap';
import { Link } from 'react-router';
import { MarcaElo, useTituloPagina } from '../../componentes';

export function PaginaCadastroFarmacia() {
  useTituloPagina('Cadastrar farmácia');

  return (
    <section className="cartao-pagina cartao-autenticacao">
      <MarcaElo />
      <span className="pagina-selo">Cadastro institucional</span>
      <h1>Cadastrar farmácia</h1>
      <p className="pagina-descricao">
        Informe os dados da farmácia para iniciar a validação do cadastro.
      </p>

      <div className="aviso-acesso">
        <strong>Validação segura</strong>
        <span>
          O cadastro utiliza os dados da empresa e um endereço de e-mail de
          contato.
        </span>
      </div>

      <Form
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <Form.Group className="mb-3" controlId="cnpj-farmacia">
          <Form.Label>
            CNPJ da farmácia <span className="text-danger">*</span>
          </Form.Label>
          <Form.Control
            type="text"
            inputMode="numeric"
            autoComplete="organization"
            placeholder="00.000.000/0000-00"
            required
            size="lg"
          />
        </Form.Group>
        <Form.Group className="mb-3" controlId="email-cadastro">
          <Form.Label>
            E-mail para contato <span className="text-danger">*</span>
          </Form.Label>
          <Form.Control
            type="email"
            autoComplete="email"
            placeholder="exemplo@farmacia.com.br"
            required
            size="lg"
          />
        </Form.Group>
        <Button
          className="w-100"
          type="submit"
          size="lg"
          disabled
          aria-describedby="cadastro-indisponivel"
        >
          Continuar cadastro
        </Button>
        <p id="cadastro-indisponivel" className="nota-indisponibilidade">
          O cadastro será habilitado quando o serviço de validação estiver
          integrado.
        </p>
      </Form>

      <div className="link-confirmacao">
        <span>Já iniciou o cadastro?</span>
        <Link to="/cadastro/confirmar">Confirmar os dados da farmácia</Link>
      </div>
    </section>
  );
}
