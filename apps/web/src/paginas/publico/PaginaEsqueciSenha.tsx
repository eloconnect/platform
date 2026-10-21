import { useState } from 'react';
import { Form } from 'react-bootstrap';
import { Link } from 'react-router';
import { ApiError } from '@eloconnect/shared';
import { api } from '../../api';
import {
  AvisoSucesso,
  Botao,
  CampoTexto,
  MensagemErro,
  useTituloPagina,
} from '../../componentes';

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
    } catch (e) {
      // A mensagem depende só do status, nunca do texto do erro (que pode vir
      // em inglês do navegador ou da API).
      setErro(
        e instanceof ApiError && e.status === 400
          ? 'Confira o e-mail digitado e tente de novo.'
          : 'Não foi possível enviar o pedido agora. Tente de novo em alguns minutos.',
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="cartao-pagina cartao-autenticacao">
      <h1 className="text-uppercase">Esqueci minha senha</h1>
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

          <CampoTexto
            rotulo="E-mail"
            type="email"
            autoComplete="email"
            placeholder="voce@farmacia.com.br"
            obrigatorio
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          <Botao className="w-100" type="submit" disabled={enviando}>
            {enviando ? 'Enviando...' : 'Enviar link de recuperação'}
          </Botao>
        </Form>
      )}
      <Link className="link-voltar-cadastro" to="/entrar">
        Voltar para o login
      </Link>
    </section>
  );
}
