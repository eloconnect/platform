import { useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import { Link } from 'react-router';
import {
  AvisoSucesso,
  MarcaElo,
  MensagemErro,
  useTituloPagina,
} from '../../componentes';
import { api } from '../../api';

/** Recuperação de senha por link no e-mail (US04, issues #18 e #19). */
export function PaginaEsqueciSenha() {
  useTituloPagina('Esqueci minha senha');
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function solicitar() {
    setEnviando(true);
    setErro(null);
    try {
      const resposta = await api.solicitarRecuperacaoSenha({
        email: email.trim(),
      });
      setMensagem(resposta.mensagem);
    } catch {
      setErro(
        'Não foi possível enviar o pedido agora. Confira o e-mail e tente novamente.',
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="cartao-pagina cartao-autenticacao">
      <MarcaElo />
      <span className="pagina-selo">Recuperação de acesso</span>
      <h1>Esqueci minha senha</h1>
      <p className="pagina-descricao">
        Informe o e-mail cadastrado. Enviaremos um link, válido por 1 hora, para
        você criar uma nova senha.
      </p>

      {mensagem ? (
        <AvisoSucesso titulo="Pedido recebido">{mensagem}</AvisoSucesso>
      ) : (
        <Form
          onSubmit={(event) => {
            event.preventDefault();
            void solicitar();
          }}
        >
          {erro && <MensagemErro>{erro}</MensagemErro>}
          <Form.Group className="mb-3" controlId="email-recuperacao">
            <Form.Label>
              E-mail cadastrado <span className="text-danger">*</span>
            </Form.Label>
            <Form.Control
              type="email"
              autoComplete="email"
              placeholder="voce@farmacia.com.br"
              required
              size="lg"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Form.Group>
          <Button className="w-100" type="submit" size="lg" disabled={enviando}>
            {enviando ? 'Enviando...' : 'Enviar link de recuperação'}
          </Button>
        </Form>
      )}
      <Link className="link-voltar-cadastro" to="/entrar">
        Voltar para o login
      </Link>
    </section>
  );
}
