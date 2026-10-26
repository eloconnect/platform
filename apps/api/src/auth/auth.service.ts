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
import { TipoToken } from '../generated/prisma/enums.js';
import { EmailService } from '../email/email.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { EsqueciSenhaDto } from './dto/esqueci-senha.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RedefinirSenhaDto } from './dto/redefinir-senha.dto.js';

const VALIDADE_TOKEN_RECUPERACAO_MS = 60 * 60 * 1000;
const MENSAGEM_RECUPERACAO =
  'Se o e-mail estiver cadastrado, enviaremos um link para redefinir a senha.';

function hashDoToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
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
      select: { id: true, nome: true, email: true, ativo: true },
    });

    if (usuario?.ativo) {
      const token = randomBytes(32).toString('base64url');
      await this.prisma.$transaction([
        this.prisma.tokenUsuario.updateMany({
          where: {
            usuarioId: usuario.id,
            tipo: TipoToken.RECUPERACAO_SENHA,
            usadoEm: null,
          },
          data: { usadoEm: new Date() },
        }),
        this.prisma.tokenUsuario.create({
          data: {
            usuarioId: usuario.id,
            tipo: TipoToken.RECUPERACAO_SENHA,
            tokenHash: hashDoToken(token),
            expiraEm: new Date(Date.now() + VALIDADE_TOKEN_RECUPERACAO_MS),
          },
        }),
      ]);

      const baseUrl =
        this.config.get<string>('WEB_URL') ?? 'http://localhost:5173';
      const link = `${baseUrl.replace(/\/$/, '')}/redefinir-senha?token=${token}`;
      // Não aguarda o envio, para o tempo de resposta não revelar se a conta existe.
      void this.email
        .send({
          to: usuario.email,
          subject: 'Redefinição de senha - Elo Connect',
          text: [
            `Olá, ${usuario.nome}.`,
            '',
            'Recebemos um pedido para redefinir a senha da sua conta no Elo Connect.',
            'Use o link abaixo em até 1 hora:',
            link,
            '',
            'Se você não fez esse pedido, ignore este e-mail: sua senha continua a mesma.',
          ].join('\n'),
        })
        .catch((error: unknown) => {
          this.logger.error(
            'Falha ao enviar o e-mail de recuperação de senha.',
            error instanceof Error ? error.stack : undefined,
          );
        });
    }

    return { mensagem: MENSAGEM_RECUPERACAO };
  }

  async redefinirSenha({ token, senha }: RedefinirSenhaDto) {
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
      registro.tipo !== TipoToken.RECUPERACAO_SENHA ||
      registro.usadoEm ||
      registro.expiraEm <= agora ||
      !registro.usuario.ativo
    ) {
      throw new BadRequestException(
        'Link inválido ou expirado. Solicite uma nova recuperação de senha.',
      );
    }

    const senhaHash = await hash(senha);
    await this.prisma.$transaction(async (tx) => {
      // Consumo condicional: dois pedidos simultâneos não usam o mesmo link.
      const consumido = await tx.tokenUsuario.updateMany({
        where: { id: registro.id, usadoEm: null, expiraEm: { gt: agora } },
        data: { usadoEm: agora },
      });
      if (consumido.count !== 1) {
        throw new BadRequestException(
          'Link inválido ou expirado. Solicite uma nova recuperação de senha.',
        );
      }
      await tx.usuario.update({
        where: { id: registro.usuarioId },
        data: { senhaHash },
      });
    });

    return { mensagem: 'Senha redefinida com sucesso.' };
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
}
