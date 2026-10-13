import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

export interface ContaAssociado {
  usuarioId: string;
  associadoId: string;
}

type RequisicaoPortal = Request & { conta?: ContaAssociado };

/** Exige token JWT de um usuário ASSOCIADO vinculado a uma farmácia. */
@Injectable()
export class PortalGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequisicaoPortal>();
    const [tipo, token] = request.headers.authorization?.split(' ') ?? [];
    const secret = this.config.get<string>('JWT_SECRET');
    if (tipo !== 'Bearer' || !token || !secret) {
      throw new UnauthorizedException('Entre com sua conta de associado.');
    }
    let sub: string | undefined;
    try {
      const payload = await this.jwt.verifyAsync<{
        perfil?: string;
        sub?: string;
      }>(token, { secret });
      if (payload.perfil !== 'ASSOCIADO') throw new Error('perfil');
      sub = payload.sub;
    } catch {
      throw new UnauthorizedException('Entre com sua conta de associado.');
    }
    const usuario = sub
      ? await this.prisma.usuario.findUnique({ where: { id: sub } })
      : null;
    if (!usuario?.ativo) {
      throw new UnauthorizedException('Entre com sua conta de associado.');
    }
    if (!usuario.associadoId) {
      throw new ForbiddenException(
        'Sua conta ainda não está vinculada a uma farmácia.',
      );
    }
    request.conta = { usuarioId: usuario.id, associadoId: usuario.associadoId };
    return true;
  }
}

export const Conta = createParamDecorator(
  (_dados: unknown, contexto: ExecutionContext): ContaAssociado => {
    const conta = contexto.switchToHttp().getRequest<RequisicaoPortal>().conta;
    if (!conta) throw new UnauthorizedException();
    return conta;
  },
);
