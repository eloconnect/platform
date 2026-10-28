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

/** As duas telas abertas por um link do e-mail mudam só nos textos. */
const TEXTOS = {
  redefinir: {
    tituloPagina: 'Redefinir senha',
    titulo: 'Criar nova senha',
    rotuloSenha: 'Nova senha',
    rotuloRepetir: 'Repita a nova senha',
    botao: 'Salvar nova senha',
    tituloSucesso: 'Senha redefinida',
    sucesso: 'Sua senha foi alterada. Já pode entrar com a nova senha.',
    falhaGenerica:
      'Não foi possível redefinir a senha agora. Tente de novo em alguns minutos.',
    novoLink: '/esqueci-senha',
  },
  criar: {
    tituloPagina: 'Criar senha',
    titulo: 'Crie sua senha',
    rotuloSenha: 'Senha',
    rotuloRepetir: 'Repita a senha',
    botao: 'Criar senha',
    tituloSucesso: 'Conta criada',
    sucesso:
      'Sua conta está pronta. Entre com o e-mail que recebeu o link e a senha que você acabou de criar.',
    falhaGenerica:
      'Não foi possível criar a senha agora. Tente de novo em alguns minutos.',
    novoLink: '/cadastro',
  },
} as const;

/**
 * Senha nova a partir do link recebido por e-mail: redefinir a senha (US04,
 * issue #19) ou criar a senha da conta nova (US02 e US05, issues #61 e #62).
 */
export function PaginaRedefinirSenha({
  variante = 'redefinir',
}: {
  variante?: keyof typeof TEXTOS;
}) {
  const textos = TEXTOS[variante];
  useTituloPagina(textos.tituloPagina);
  const [parametros] = useSearchParams();
  const token = parametros.get('token');
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [concluido, setConcluido] = useState(false);
  const [falha, setFalha] = useState<Falha | null>(null);
  const [erroConfirmacao, setErroConfirmacao] = useState<string | null>(null);

  async function salvar() {
    if (!token) return;
    setFalha(null);
    if (senha !== confirmacao) {
      setErroConfirmacao('As senhas não são iguais.');
      return;
    }
    setErroConfirmacao(null);
    setEnviando(true);
    try {
      if (variante === 'criar') {
        await api.confirmarConta({ token, senha });
      } else {
        await api.redefinirSenha({ token, senha });
      }
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
      <h1 className="text-uppercase">{textos.titulo}</h1>

      {concluido ? (
        <>
          <AvisoSucesso titulo={textos.tituloSucesso}>
            {textos.sucesso}
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
          <Link to={textos.novoLink}>Pedir um novo link</Link>
        </>
      ) : (
        <Form
          onSubmit={(event) => {
            event.preventDefault();
            void salvar();
          }}
        >
          {falha === 'link' && (
            <>
              <MensagemErro>
                Este link expirou ou já foi usado. Peça um novo link.
              </MensagemErro>
              <p>
                <Link to={textos.novoLink}>Pedir um novo link</Link>
              </p>
            </>
          )}
          {falha === 'generica' && (
            <MensagemErro>{textos.falhaGenerica}</MensagemErro>
          )}

          <CampoTexto
            rotulo={textos.rotuloSenha}
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
            rotulo={textos.rotuloRepetir}
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
            {enviando ? 'Salvando...' : textos.botao}
          </Botao>
        </Form>
      )}
    </section>
  );
}
