import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '../generated/prisma/enums';
import { ROLES_KEY } from './roles.decorator';
import type { AuthRequest } from './auth.types';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthRequest>();
    if (!request.authUser || !requiredRoles.includes(request.authUser.role)) {
      throw new ForbiddenException('Seu perfil não tem acesso a este recurso.');
    }
    return true;
  }
}
