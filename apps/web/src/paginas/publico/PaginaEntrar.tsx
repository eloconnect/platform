import { useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router';
import { ApiError } from '@eloconnect/shared';
import { api } from '../../api';
import { MarcaElo, MensagemErro, useTituloPagina } from '../../componentes';
import { destinoPorPerfil, salvarSessao } from '../../sessao';

/** Login com e-mail e senha (US03, issues #16 e #17). */
export function PaginaEntrar() {
  useTituloPagina('Entrar');
  const navegar = useNavigate();
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [lembrar, setLembrar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function entrar() {
    setEnviando(true);
    setErro(null);
    try {
      const sessao = await api.login({ email: email.trim(), senha });
      salvarSessao(sessao, lembrar);
      await navegar(destinoPorPerfil(sessao.usuario.perfil));
    } catch (e) {
      setErro(
        e instanceof ApiError && (e.status === 401 || e.status === 400)
          ? 'E-mail ou senha inválidos. Confira os dados e tente novamente.'
          : 'Não foi possível entrar agora. Tente novamente em instantes.',
      );
      setEnviando(false);
    }
  }

  return (
    <section className="cartao-pagina cartao-autenticacao">
      <MarcaElo />
      <h1>Acesse sua área</h1>

      <nav className="alternador-acesso" aria-label="Tipo de acesso">
        <Link
          className="alternador-acesso-ativo"
          to="/entrar"
          aria-current="page"
        >
          Já sou associado
        </Link>
        <Link to="/cadastro">Cadastrar farmácia</Link>
      </nav>

      <div className="aviso-acesso">
        <strong>Acesso da farmácia associada</strong>
        <span>
          O contador usa a conta do associado. O compartilhamento do acesso é
          responsabilidade do titular da conta.
        </span>
      </div>

      <Form
        onSubmit={(event) => {
          event.preventDefault();
          void entrar();
        }}
      >
        {erro && <MensagemErro>{erro}</MensagemErro>}
        <Form.Group className="mb-3" controlId="email-login">
          <Form.Label>
            E-mail cadastrado <span className="text-danger">*</span>
          </Form.Label>
          <Form.Control
            type="email"
            autoComplete="username"
            placeholder="voce@farmacia.com.br"
            required
            size="lg"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Form.Group>

        <Form.Group className="mb-3" controlId="senha-login">
          <div className="d-flex align-items-center justify-content-between gap-2">
            <Form.Label>
              Senha de acesso <span className="text-danger">*</span>
            </Form.Label>
            <Link to="/esqueci-senha" className="link-pequeno">
              Esqueci minha senha
            </Link>
          </div>
          <div className="input-senha">
            <Form.Control
              type={mostrarSenha ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Digite sua senha"
              required
              size="lg"
              value={senha}
              onChange={(event) => setSenha(event.target.value)}
            />
            <Button
              variant="outline-secondary"
              type="button"
              aria-pressed={mostrarSenha}
              onClick={() => setMostrarSenha((visivel) => !visivel)}
            >
              {mostrarSenha ? 'Ocultar' : 'Mostrar'}
            </Button>
          </div>
        </Form.Group>

        <Form.Check
          className="mb-3"
          type="checkbox"
          id="lembrar-dispositivo"
          label="Lembrar neste dispositivo"
          checked={lembrar}
          onChange={(event) => setLembrar(event.target.checked)}
        />

        <Button className="w-100" type="submit" size="lg" disabled={enviando}>
          {enviando ? 'Entrando...' : 'Continuar'}
        </Button>
      </Form>
    </section>
  );
}
