import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { readSessionToken } from './session-cookie';
import type { AuthRequest } from './auth.types';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const token = readSessionToken(request);
    if (!token) {
      throw new UnauthorizedException('Autenticação necessária.');
    }

    const session = await this.authService.getSession(token);
    if (!session) {
      throw new UnauthorizedException('Sessão inválida ou expirada.');
    }
    request.authSessionId = session.sessionId;
    request.authUser = session.user;
    return true;
  }
}
