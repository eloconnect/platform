import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

/** Id do administrador autenticado (definido pelo AdminGuard). */
export const AdminId = createParamDecorator(
  (_dados: unknown, context: ExecutionContext): string =>
    context.switchToHttp().getRequest<{ adminId: string }>().adminId,
);
