import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

/** Exige token JWT válido de um usuário com perfil ADMIN. */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { adminId?: string }>();
    const [tipo, token] = request.headers.authorization?.split(' ') ?? [];
    const secret = this.config.get<string>('JWT_SECRET');
    if (tipo !== 'Bearer' || !token || !secret) {
      throw new UnauthorizedException('Acesso restrito à sede.');
    }
    try {
      const payload = await this.jwt.verifyAsync<{
        perfil?: string;
        sub?: string;
      }>(token, { secret });
      if (payload.perfil !== 'ADMIN' || !payload.sub) throw new Error('perfil');
      request.adminId = payload.sub;
    } catch {
      throw new UnauthorizedException('Acesso restrito à sede.');
    }
    return true;
  }
}
