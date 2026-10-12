import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AUTH_COOKIE_NAME } from './auth.constants';
import type { AuthRequest } from './auth.types';
import { AuthService } from './auth.service';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const sessionToken = request.cookies?.[AUTH_COOKIE_NAME];
    if (!sessionToken) {
      throw new UnauthorizedException('Autenticação necessária.');
    }

    const session = await this.authService.getSessionUser(sessionToken);
    if (!session) {
      throw new UnauthorizedException('Sessão inválida ou expirada.');
    }

    request.authUser = session.user;
    request.authSessionId = session.sessionId;
    return true;
  }
}
