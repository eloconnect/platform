import { useState } from 'react';
import { Form } from 'react-bootstrap';
import { Link } from 'react-router';
import { ApiError, cnpjValido } from '@eloconnect/shared';
import { api } from '../../api';
import {
  AvisoSucesso,
  Botao,
  CampoTexto,
  MensagemErro,
  useTituloPagina,
} from '../../componentes';

/**
 * Criação de conta pelo CNPJ (US02 e US05, issues #61 e #62): o link para
 * criar a senha vai para o e-mail que já está no cadastro do sindicato.
 */
export function PaginaCadastro() {
  useTituloPagina('Criar conta');
  const [cnpj, setCnpj] = useState('');
  const [erroCnpj, setErroCnpj] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function solicitar() {
    setErro(null);
    if (!cnpjValido(cnpj)) {
      setErroCnpj('CNPJ inválido. Confira os números digitados.');
      document.getElementById('campo-cnpj')?.focus();
      return;
    }
    setErroCnpj(undefined);
    setEnviando(true);
    try {
      const resposta = await api.criarConta({ cnpj: cnpj.trim() });
      setMensagem(resposta.mensagem);
    } catch (e) {
      // A mensagem depende só do status, nunca do texto do erro (que pode vir
      // em inglês do navegador ou da API).
      setErro(
        e instanceof ApiError && e.status === 400
          ? 'Confira o CNPJ digitado e tente de novo.'
          : 'Não foi possível enviar o pedido agora. Tente de novo em alguns minutos.',
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="cartao-pagina cartao-autenticacao">
      <h1 className="text-uppercase">Criar conta</h1>
      <p className="pagina-descricao">
        Informe o CNPJ da farmácia. Enviaremos um link, válido por 24 horas,
        para o e-mail da farmácia que está no cadastro do sindicato. Pelo link,
        você cria a sua senha.
      </p>

      {mensagem ? (
        <>
          <AvisoSucesso titulo="Pedido recebido">{mensagem}</AvisoSucesso>
          <p>
            Se o e-mail não chegar em alguns minutos, confira a caixa de spam.
            Se a farmácia ainda não está no cadastro, ou se o e-mail do cadastro
            mudou, fale com a sede do sindicato.
          </p>
        </>
      ) : (
        <Form
          onSubmit={(event) => {
            event.preventDefault();
            void solicitar();
          }}
        >
          {erro && <MensagemErro>{erro}</MensagemErro>}

          <CampoTexto
            id="campo-cnpj"
            rotulo="CNPJ da farmácia"
            autoComplete="off"
            placeholder="00.000.000/0000-00"
            obrigatorio
            erro={erroCnpj}
            value={cnpj}
            onChange={(event) => setCnpj(event.target.value)}
          />

          <Botao className="w-100" type="submit" disabled={enviando}>
            {enviando ? 'Enviando...' : 'Enviar link para criar a senha'}
          </Botao>
        </Form>
      )}
      <Link className="link-voltar-cadastro" to="/entrar">
        Já tenho conta: entrar
      </Link>
    </section>
  );
}
