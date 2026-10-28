import { createHash, randomBytes } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';
import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '../generated/prisma/client.js';
import { Perfil, TipoToken } from '../generated/prisma/enums.js';
import { EmailService, type EmailMessage } from '../email/email.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ConfirmarContaDto } from './dto/confirmar-conta.dto.js';
import { CriarContaDto } from './dto/criar-conta.dto.js';
import { EsqueciSenhaDto } from './dto/esqueci-senha.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RedefinirSenhaDto } from './dto/redefinir-senha.dto.js';

const VALIDADE_TOKEN_RECUPERACAO_MS = 60 * 60 * 1000;
// Quem lê o e-mail da farmácia nem sempre é o dono, e nem sempre na hora
// (resposta 45 do questionário), por isso o link de criar a senha vale mais.
const VALIDADE_TOKEN_CONFIRMACAO_MS = 24 * 60 * 60 * 1000;
// O CNPJ é público: sem este intervalo, qualquer pessoa poderia encher a
// caixa de e-mail da farmácia pedindo a criação da conta.
const INTERVALO_MINIMO_ENTRE_EMAILS_MS = 2 * 60 * 1000;
const MENSAGEM_RECUPERACAO =
  'Se o e-mail estiver cadastrado, enviaremos um link para redefinir a senha.';
const MENSAGEM_CRIACAO_CONTA =
  'Se o CNPJ estiver no cadastro do sindicato, enviamos um link para o e-mail da farmácia que está no cadastro.';
const LINK_INVALIDO_RECUPERACAO =
  'Link inválido ou expirado. Solicite uma nova recuperação de senha.';
const LINK_INVALIDO_CONTA =
  'Link inválido ou expirado. Peça um novo link em "Criar conta".';

function hashDoToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

interface AssociadoDaConta {
  id: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  email: string;
  usuario: {
    id: string;
    email: string;
    ativo: boolean;
    emailConfirmadoEm: Date | null;
  } | null;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
  ) {}

  /** Resposta sempre igual, exista ou não a conta, para não revelar cadastros. */
  async solicitarRecuperacaoSenha({ email }: EsqueciSenhaDto) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { email },
      select: {
        id: true,
        nome: true,
        email: true,
        ativo: true,
        emailConfirmadoEm: true,
      },
    });

    // A conta que ainda não tem senha a cria pelo link de "Criar conta".
    if (usuario?.ativo && usuario.emailConfirmadoEm) {
      const token = await this.emitirToken(
        usuario.id,
        TipoToken.RECUPERACAO_SENHA,
        VALIDADE_TOKEN_RECUPERACAO_MS,
      );
      this.enviarEmSegundoPlano(
        {
          to: usuario.email,
          subject: 'Redefinição de senha - Elo Connect',
          text: [
            `Olá, ${usuario.nome}.`,
            '',
            'Recebemos um pedido para redefinir a senha da sua conta no Elo Connect.',
            'Use o link abaixo em até 1 hora:',
            this.link('/redefinir-senha', token),
            '',
            'Se você não fez esse pedido, ignore este e-mail: sua senha continua a mesma.',
          ].join('\n'),
        },
        'recuperação de senha',
      );
    }

    return { mensagem: MENSAGEM_RECUPERACAO };
  }

  async redefinirSenha({ token, senha }: RedefinirSenhaDto) {
    await this.usarToken(
      token,
      TipoToken.RECUPERACAO_SENHA,
      senha,
      LINK_INVALIDO_RECUPERACAO,
    );
    return { mensagem: 'Senha redefinida com sucesso.' };
  }

  /**
   * Criação de conta pelo CNPJ (RF05, RN21). A farmácia precisa estar no
   * cadastro do sindicato, com e-mail, e o link vai para esse e-mail.
   * Resposta sempre igual, para não revelar quem está no cadastro.
   */
  async solicitarCriacaoConta({ cnpj }: CriarContaDto) {
    const associado = await this.prisma.associado.findUnique({
      where: { cnpj },
      select: {
        id: true,
        razaoSocial: true,
        nomeFantasia: true,
        email: true,
        inativadoEm: true,
        usuario: {
          select: {
            id: true,
            email: true,
            ativo: true,
            emailConfirmadoEm: true,
          },
        },
      },
    });

    if (associado?.email && !associado.inativadoEm) {
      await this.enviarLinkDaConta({ ...associado, email: associado.email });
    }

    return { mensagem: MENSAGEM_CRIACAO_CONTA };
  }

  /** Senha criada pelo link do e-mail: a conta passa a entrar (RF05). */
  async confirmarConta({ token, senha }: ConfirmarContaDto) {
    await this.usarToken(
      token,
      TipoToken.CONFIRMACAO_EMAIL,
      senha,
      LINK_INVALIDO_CONTA,
    );
    return { mensagem: 'Conta criada. Já pode entrar com o e-mail e a senha.' };
  }

  async login(loginDto: LoginDto) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { email: loginDto.email },
      select: {
        id: true,
        email: true,
        nome: true,
        perfil: true,
        senhaHash: true,
        ativo: true,
        emailConfirmadoEm: true,
      },
    });

    if (
      !usuario ||
      !usuario.ativo ||
      !usuario.emailConfirmadoEm ||
      !usuario.senhaHash ||
      !(await verify(usuario.senhaHash, loginDto.senha))
    ) {
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }

    const secret = this.config.get<string>('JWT_SECRET');
    if (!secret || secret.length < 32) {
      throw new Error('JWT_SECRET deve ter pelo menos 32 caracteres.');
    }

    const accessToken = await this.jwtService.signAsync(
      { perfil: usuario.perfil },
      { secret, subject: usuario.id, expiresIn: '1h' },
    );

    return {
      accessToken,
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nome: usuario.nome,
        perfil: usuario.perfil,
      },
    };
  }

  private async enviarLinkDaConta(associado: AssociadoDaConta) {
    const nome = associado.nomeFantasia ?? associado.razaoSocial;
    const conta = associado.usuario;

    if (conta?.emailConfirmadoEm) {
      // A farmácia já tem conta: em vez de criar outra, manda o link para
      // trocar a senha, no e-mail da conta.
      if (!conta.ativo || (await this.pedidoRecente(conta.id))) return;
      const token = await this.emitirToken(
        conta.id,
        TipoToken.RECUPERACAO_SENHA,
        VALIDADE_TOKEN_RECUPERACAO_MS,
      );
      this.enviarEmSegundoPlano(
        {
          to: conta.email,
          subject: 'Sua conta no Elo Connect',
          text: [
            `Olá, ${nome}.`,
            '',
            'Recebemos um pedido para criar a conta da sua farmácia no Elo Connect, mas ela já tem uma conta.',
            `Para entrar, use o e-mail ${conta.email} e a sua senha.`,
            'Se não lembra a senha, crie uma nova pelo link abaixo, em até 1 hora:',
            this.link('/redefinir-senha', token),
            '',
            'Se você não fez esse pedido, ignore este e-mail: sua senha continua a mesma.',
          ].join('\n'),
        },
        'conta já existente',
      );
      return;
    }

    const email = associado.email.toLowerCase();
    const usuarioId = await this.contaPendente(
      associado.id,
      conta,
      email,
      nome,
    );
    if (!usuarioId || (await this.pedidoRecente(usuarioId))) return;
    const token = await this.emitirToken(
      usuarioId,
      TipoToken.CONFIRMACAO_EMAIL,
      VALIDADE_TOKEN_CONFIRMACAO_MS,
    );
    this.enviarEmSegundoPlano(
      {
        to: email,
        subject: 'Crie sua senha - Elo Connect',
        text: [
          `Olá, ${nome}.`,
          '',
          'Recebemos um pedido para criar a conta da sua farmácia no Elo Connect.',
          'Para terminar, crie sua senha pelo link abaixo, em até 24 horas:',
          this.link('/criar-senha', token),
          '',
          `Depois, entre com este e-mail (${email}) e a senha que você criou.`,
          '',
          'Se você não fez esse pedido, ignore este e-mail: a conta só funciona depois que a senha é criada.',
        ].join('\n'),
      },
      'criação de conta',
    );
  }

  /**
   * Conta ainda sem senha, criada no primeiro pedido. Se a sede trocou o
   * e-mail do cadastro, a conta pendente passa a usar o novo. Devolve nulo
   * quando o e-mail já é de outra conta.
   */
  private async contaPendente(
    associadoId: string,
    conta: AssociadoDaConta['usuario'],
    email: string,
    nome: string,
  ): Promise<string | null> {
    try {
      if (!conta) {
        const criada = await this.prisma.usuario.create({
          data: { email, nome, perfil: Perfil.ASSOCIADO, associadoId },
          select: { id: true },
        });
        return criada.id;
      }
      if (!conta.ativo) return null;
      if (conta.email !== email) {
        await this.prisma.usuario.update({
          where: { id: conta.id },
          data: { email },
        });
      }
      return conta.id;
    } catch (erro) {
      // TODO(P18): o mesmo e-mail em mais de uma farmácia (ex.: o do
      // contador). Também cai aqui quando dois pedidos chegam juntos.
      if (
        erro instanceof Prisma.PrismaClientKnownRequestError &&
        erro.code === 'P2002'
      ) {
        this.logger.warn(
          `Conta não criada para o associado ${associadoId}: o e-mail já é de outra conta.`,
        );
        return null;
      }
      throw erro;
    }
  }

  private async pedidoRecente(usuarioId: string): Promise<boolean> {
    const ultimo = await this.prisma.tokenUsuario.findFirst({
      where: { usuarioId },
      orderBy: { criadoEm: 'desc' },
      select: { criadoEm: true },
    });
    return (
      ultimo !== null &&
      Date.now() - ultimo.criadoEm.getTime() < INTERVALO_MINIMO_ENTRE_EMAILS_MS
    );
  }

  /** Token de uso único; invalida os anteriores do mesmo tipo. Grava só o hash. */
  private async emitirToken(
    usuarioId: string,
    tipo: TipoToken,
    validadeMs: number,
  ): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await this.prisma.$transaction([
      this.prisma.tokenUsuario.updateMany({
        where: { usuarioId, tipo, usadoEm: null },
        data: { usadoEm: new Date() },
      }),
      this.prisma.tokenUsuario.create({
        data: {
          usuarioId,
          tipo,
          tokenHash: hashDoToken(token),
          expiraEm: new Date(Date.now() + validadeMs),
        },
      }),
    ]);
    return token;
  }

  /** Consome o token do link e grava a senha nova. */
  private async usarToken(
    token: string,
    tipo: TipoToken,
    senha: string,
    mensagemLinkInvalido: string,
  ) {
    const agora = new Date();
    const registro = await this.prisma.tokenUsuario.findUnique({
      where: { tokenHash: hashDoToken(token) },
      select: {
        id: true,
        usuarioId: true,
        tipo: true,
        usadoEm: true,
        expiraEm: true,
        usuario: { select: { ativo: true } },
      },
    });

    if (
      !registro ||
      registro.tipo !== tipo ||
      registro.usadoEm ||
      registro.expiraEm <= agora ||
      !registro.usuario.ativo
    ) {
      throw new BadRequestException(mensagemLinkInvalido);
    }

    const senhaHash = await hash(senha);
    await this.prisma.$transaction(async (tx) => {
      // Consumo condicional: dois pedidos simultâneos não usam o mesmo link.
      const consumido = await tx.tokenUsuario.updateMany({
        where: { id: registro.id, usadoEm: null, expiraEm: { gt: agora } },
        data: { usadoEm: agora },
      });
      if (consumido.count !== 1) {
        throw new BadRequestException(mensagemLinkInvalido);
      }
      await tx.usuario.update({
        where: { id: registro.usuarioId },
        // Quem abriu o link do e-mail prova que lê esse e-mail.
        data:
          tipo === TipoToken.CONFIRMACAO_EMAIL
            ? { senhaHash, emailConfirmadoEm: agora }
            : { senhaHash },
      });
    });
  }

  private link(caminho: string, token: string): string {
    const baseUrl =
      this.config.get<string>('WEB_URL') ?? 'http://localhost:5173';
    return `${baseUrl.replace(/\/$/, '')}${caminho}?token=${token}`;
  }

  /** Não aguarda o envio, para o tempo de resposta não revelar se a conta existe. */
  private enviarEmSegundoPlano(mensagem: EmailMessage, assunto: string) {
    void this.email.send(mensagem).catch((error: unknown) => {
      this.logger.error(
        `Falha ao enviar o e-mail de ${assunto}.`,
        error instanceof Error ? error.stack : undefined,
      );
    });
  }
}
