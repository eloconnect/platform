import { useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import { Link, useSearchParams } from 'react-router';
import { ApiError } from '@eloconnect/shared';
import { api } from '../../api';
import {
  AvisoSucesso,
  MarcaElo,
  MensagemErro,
  useTituloPagina,
} from '../../componentes';

const TAMANHO_MINIMO_SENHA = 8;

/** Define a nova senha a partir do link recebido por e-mail (US04, issue #18). */
export function PaginaRedefinirSenha() {
  useTituloPagina('Redefinir senha');
  const [parametros] = useSearchParams();
  const token = parametros.get('token');
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [concluido, setConcluido] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function redefinir() {
    if (!token) return;
    if (senha !== confirmacao) {
      setErro('As senhas não são iguais.');
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      await api.redefinirSenha({ token, senha });
      setConcluido(true);
    } catch (e) {
      setErro(
        e instanceof ApiError && e.status === 400
          ? 'Link inválido ou expirado. Solicite uma nova recuperação de senha.'
          : 'Não foi possível redefinir a senha agora. Tente novamente em instantes.',
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="cartao-pagina cartao-autenticacao">
      <MarcaElo />
      <span className="pagina-selo">Recuperação de acesso</span>
      <h1>Criar nova senha</h1>

      {concluido ? (
        <>
          <AvisoSucesso titulo="Senha redefinida">
            Sua senha foi alterada. Já pode entrar com a nova senha.
          </AvisoSucesso>
          <Link className="btn btn-primary btn-lg w-100" to="/entrar">
            Ir para o login
          </Link>
        </>
      ) : !token ? (
        <>
          <MensagemErro>
            Link inválido. Solicite uma nova recuperação de senha.
          </MensagemErro>
          <Link className="link-voltar-cadastro" to="/esqueci-senha">
            Solicitar novo link
          </Link>
        </>
      ) : (
        <Form
          onSubmit={(event) => {
            event.preventDefault();
            void redefinir();
          }}
        >
          {erro && <MensagemErro>{erro}</MensagemErro>}
          <Form.Group className="mb-3" controlId="nova-senha">
            <Form.Label>
              Nova senha <span className="text-danger">*</span>
            </Form.Label>
            <Form.Control
              type="password"
              autoComplete="new-password"
              minLength={TAMANHO_MINIMO_SENHA}
              maxLength={128}
              required
              size="lg"
              value={senha}
              onChange={(event) => setSenha(event.target.value)}
            />
            <Form.Text>
              Use pelo menos {TAMANHO_MINIMO_SENHA} caracteres.
            </Form.Text>
          </Form.Group>
          <Form.Group className="mb-3" controlId="confirmar-nova-senha">
            <Form.Label>
              Repita a nova senha <span className="text-danger">*</span>
            </Form.Label>
            <Form.Control
              type="password"
              autoComplete="new-password"
              minLength={TAMANHO_MINIMO_SENHA}
              maxLength={128}
              required
              size="lg"
              value={confirmacao}
              onChange={(event) => setConfirmacao(event.target.value)}
            />
          </Form.Group>
          <Button className="w-100" type="submit" size="lg" disabled={enviando}>
            {enviando ? 'Salvando...' : 'Salvar nova senha'}
          </Button>
        </Form>
      )}
    </section>
  );
}
