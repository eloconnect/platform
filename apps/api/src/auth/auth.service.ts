import { Injectable, UnauthorizedException } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SESSION_TTL_MS } from './auth.constants';
import type { AuthenticatedUser } from './auth.types';

const INVALID_CREDENTIALS = 'E-mail ou senha inválidos.';

@Injectable()
export class AuthService {
  private dummyHashPromise?: Promise<string>;

  constructor(private readonly prisma: PrismaService) {}

  async login(email: string, password: string) {
    const user = await this.prisma.usuario.findUnique({
      where: { email },
    });

    const passwordHash = user?.senhaHash ?? (await this.getDummyHash());
    const passwordIsValid = await verify(passwordHash, password);
    if (!user || !user.ativo || !passwordIsValid) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    const session = await this.prisma.sessaoAutenticacao.create({
      data: {
        usuarioId: user.id,
        tokenHash: this.hashToken(token),
        expiraEm: expiresAt,
      },
      select: { id: true },
    });

    return {
      token,
      expiresAt,
      user: this.toAuthenticatedUser(user),
      sessionId: session.id,
    };
  }

  async getSession(token: string): Promise<{
    sessionId: string;
    user: AuthenticatedUser;
  } | null> {
    const session = await this.prisma.sessaoAutenticacao.findFirst({
      where: {
        tokenHash: this.hashToken(token),
        expiraEm: { gt: new Date() },
        usuario: { ativo: true },
      },
      include: { usuario: true },
    });

    if (!session) {
      return null;
    }
    return {
      sessionId: session.id,
      user: this.toAuthenticatedUser(session.usuario),
    };
  }

  async logout(token: string | undefined): Promise<void> {
    if (!token) {
      return;
    }
    await this.prisma.sessaoAutenticacao.deleteMany({
      where: { tokenHash: this.hashToken(token) },
    });
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private getDummyHash(): Promise<string> {
    this.dummyHashPromise ??= hash('invalid-login-dummy-password');
    return this.dummyHashPromise;
  }

  private toAuthenticatedUser(user: {
    id: string;
    email: string;
    nome: string;
    perfil: AuthenticatedUser['perfil'];
  }): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      nome: user.nome,
      perfil: user.perfil,
    };
  }
}
