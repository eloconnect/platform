import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Perfil } from '../generated/prisma/enums';
import { PERFIS_METADATA } from './roles.decorator';
import type { AuthRequest } from './auth.types';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredProfiles = this.reflector.getAllAndOverride<Perfil[]>(
      PERFIS_METADATA,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredProfiles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthRequest>();
    return Boolean(
      request.authUser && requiredProfiles.includes(request.authUser.perfil),
    );
  }
}
