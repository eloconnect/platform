import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { REQUIRE_FINANCIAL_ACCESS_KEY } from '../decorators/require-access.decorator';
import { podeAcessarRecursoRestrito } from '@eloconnect/shared';

interface UsuarioAutenticado {
  sub?: string;
  perfil?: string;
}

interface RequestComUsuario {
  user?: UsuarioAutenticado;
}

@Injectable()
export class AccessStatusGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const exigeAcessoFinanceiro = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_FINANCIAL_ACCESS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!exigeAcessoFinanceiro) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestComUsuario>();

    const usuario = request.user;

    if (!usuario?.sub || !usuario.perfil) {
      throw new UnauthorizedException('Usuário não autenticado.');
    }

    if (usuario.perfil === 'ADMIN') {
      return true;
    }

    if (usuario.perfil !== 'ASSOCIADO') {
      throw new ForbiddenException('Perfil sem permissão para este recurso.');
    }

    const registro = await this.prisma.usuario.findUnique({
      where: { id: usuario.sub },
      select: {
        ativo: true,
        associado: {
          select: {
            situacao: true,
            acessoManual: true,
            inativadoEm: true,
          },
        },
      },
    });

    if (
      !registro?.ativo ||
      !registro.associado ||
      registro.associado.inativadoEm !== null
    ) {
      throw new ForbiddenException('Associado sem acesso a este recurso.');
    }

    const permitido = podeAcessarRecursoRestrito(
      registro.associado.situacao,
      registro.associado.acessoManual,
    );

    if (!permitido) {
      throw new ForbiddenException(
        'Acesso restrito a associados adimplentes ou liberados pela sede.',
      );
    }

    return true;
  }
}
