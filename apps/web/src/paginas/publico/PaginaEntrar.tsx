import { useState } from 'react';
import { Form } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router';
import { ApiError } from '@eloconnect/shared';
import { api } from '../../api';
import {
  Botao,
  CampoTexto,
  MensagemErro,
  useTituloPagina,
} from '../../componentes';
import { destinoPorPerfil, salvarSessao } from '../../sessao';

/** Login com e-mail e senha (US03, issues #16 e #17). */
export function PaginaEntrar() {
  useTituloPagina('Entrar');
  const navegar = useNavigate();
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function entrar() {
    setEnviando(true);
    setErro(null);
    try {
      const sessao = await api.login({ email: email.trim(), senha });
      salvarSessao(sessao, false);
      await navegar(destinoPorPerfil(sessao.usuario.perfil));
    } catch (e) {
      // A mensagem depende só do status, nunca do texto do erro (que pode vir
      // em inglês do navegador ou da API).
      setErro(
        e instanceof ApiError && e.status === 401
          ? 'E-mail ou senha incorretos.'
          : 'Não foi possível entrar agora. Tente de novo em alguns minutos.',
      );
      setEnviando(false);
    }
  }

  return (
    <section className="cartao-pagina cartao-autenticacao">
      <h1 className="text-center mb-4 text-uppercase">Entrar</h1>

      <Form
        onSubmit={(event) => {
          event.preventDefault();
          void entrar();
        }}
      >
        {erro && <MensagemErro>{erro}</MensagemErro>}

        <CampoTexto
          rotulo="E-mail"
          type="email"
          autoComplete="username"
          placeholder="voce@farmacia.com.br"
          obrigatorio
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />

        <CampoTexto
          rotulo="Senha"
          type={mostrarSenha ? 'text' : 'password'}
          autoComplete="current-password"
          placeholder="Digite sua senha"
          obrigatorio
          value={senha}
          onChange={(event) => setSenha(event.target.value)}
        />

        <div className="d-flex align-items-center justify-content-between gap-2 mb-3">
          <Botao
            variant="outline-secondary"
            type="button"
            aria-pressed={mostrarSenha}
            onClick={() => setMostrarSenha((visivel) => !visivel)}
          >
            {mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
          </Botao>
          <Link to="/esqueci-senha" className="link-pequeno">
            Esqueci minha senha
          </Link>
        </div>

        <Botao className="w-100" type="submit" disabled={enviando}>
          {enviando ? 'Entrando...' : 'Entrar'}
        </Botao>
      </Form>
    </section>
  );
}
