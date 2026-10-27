import {
  createParamDecorator,
  type ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

/**
 * Id do usuário logado (o `sub` do token). Use junto com o RolesGuard, que
 * valida o token e preenche `request.user`.
 */
export const UsuarioAtual = createParamDecorator(
  (_dados: unknown, contexto: ExecutionContext): string => {
    const request = contexto
      .switchToHttp()
      .getRequest<{ user?: { sub?: string } }>();
    const id = request.user?.sub;
    if (!id) {
      throw new UnauthorizedException('Usuário não autenticado.');
    }
    return id;
  },
);
