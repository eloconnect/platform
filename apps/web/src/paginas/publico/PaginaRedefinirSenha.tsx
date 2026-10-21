import { useState } from 'react';
import { Form } from 'react-bootstrap';
import { Link, useSearchParams } from 'react-router';
import { ApiError } from '@eloconnect/shared';
import { api } from '../../api';
import {
  AvisoSucesso,
  Botao,
  CampoTexto,
  MensagemErro,
  useTituloPagina,
} from '../../componentes';

const TAMANHO_MINIMO_SENHA = 8;

type Falha = 'link' | 'generica';

/** Define a nova senha a partir do link recebido por e-mail (US04, issue #19). */
export function PaginaRedefinirSenha() {
  useTituloPagina('Redefinir senha');
  const [parametros] = useSearchParams();
  const token = parametros.get('token');
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [concluido, setConcluido] = useState(false);
  const [falha, setFalha] = useState<Falha | null>(null);
  const [erroConfirmacao, setErroConfirmacao] = useState<string | null>(null);

  async function redefinir() {
    if (!token) return;
    setFalha(null);
    if (senha !== confirmacao) {
      setErroConfirmacao('As senhas não são iguais.');
      return;
    }
    setErroConfirmacao(null);
    setEnviando(true);
    try {
      await api.redefinirSenha({ token, senha });
      setConcluido(true);
    } catch (e) {
      // A mensagem depende só do status, nunca do texto do erro (que pode vir
      // em inglês do navegador ou da API).
      setFalha(e instanceof ApiError && e.status === 400 ? 'link' : 'generica');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="cartao-pagina cartao-autenticacao">
      <h1 className="text-uppercase">Criar nova senha</h1>

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
            Este link não é válido. Peça um novo link.
          </MensagemErro>
          <Link to="/esqueci-senha">Pedir um novo link</Link>
        </>
      ) : (
        <Form
          onSubmit={(event) => {
            event.preventDefault();
            void redefinir();
          }}
        >
          {falha === 'link' && (
            <>
              <MensagemErro>
                Este link expirou ou já foi usado. Peça um novo link.
              </MensagemErro>
              <p>
                <Link to="/esqueci-senha">Pedir um novo link</Link>
              </p>
            </>
          )}
          {falha === 'generica' && (
            <MensagemErro>
              Não foi possível redefinir a senha agora. Tente de novo em alguns
              minutos.
            </MensagemErro>
          )}

          <CampoTexto
            rotulo="Nova senha"
            type="password"
            autoComplete="new-password"
            ajuda={`Use pelo menos ${TAMANHO_MINIMO_SENHA} caracteres.`}
            minLength={TAMANHO_MINIMO_SENHA}
            maxLength={128}
            obrigatorio
            value={senha}
            onChange={(event) => setSenha(event.target.value)}
          />

          <CampoTexto
            rotulo="Repita a nova senha"
            type="password"
            autoComplete="new-password"
            minLength={TAMANHO_MINIMO_SENHA}
            maxLength={128}
            obrigatorio
            erro={erroConfirmacao ?? undefined}
            value={confirmacao}
            onChange={(event) => setConfirmacao(event.target.value)}
          />

          <Botao className="w-100" type="submit" disabled={enviando}>
            {enviando ? 'Salvando...' : 'Salvar nova senha'}
          </Botao>
        </Form>
      )}
    </section>
  );
}
