import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service.js';
import { REQUIRE_FINANCIAL_ACCESS_KEY } from '../decorators/require-access.decorator.js';
import {
  acessoManualEmVigor,
  podeAcessarRecursoRestrito,
} from '@eloconnect/shared';

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

    if (usuario.perfil === 'ADMIN' || usuario.perfil === 'ADMIN_BASICO') {
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
            acessoManualAte: true,
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

    // A liberação manual vencida volta a seguir o pagamento (RN11).
    const permitido = podeAcessarRecursoRestrito(
      registro.associado.situacao,
      acessoManualEmVigor(
        registro.associado.acessoManual,
        registro.associado.acessoManualAte,
      ),
    );

    if (!permitido) {
      throw new ForbiddenException(
        'Acesso restrito a associados adimplentes ou liberados pela sede.',
      );
    }

    return true;
  }
}
