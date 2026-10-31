import { timingSafeEqual } from 'node:crypto';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Libera as tarefas agendadas só para o cron da Vercel, que manda o
 * `CRON_SECRET` no cabeçalho `Authorization: Bearer`. Sem a variável, recusa
 * todo pedido.
 */
@Injectable()
export class CronGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const segredo = this.config.get<string>('CRON_SECRET');
    const { authorization } = context
      .switchToHttp()
      .getRequest<{ headers: { authorization?: string } }>().headers;
    const esperado = Buffer.from(`Bearer ${segredo}`);
    const recebido = Buffer.from(authorization ?? '');
    if (
      !segredo ||
      recebido.length !== esperado.length ||
      !timingSafeEqual(recebido, esperado)
    ) {
      throw new UnauthorizedException();
    }
    return true;
  }
}
