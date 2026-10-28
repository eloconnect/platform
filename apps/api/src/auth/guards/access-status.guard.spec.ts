import { jest } from '@jest/globals';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccessStatusGuard } from './access-status.guard.js';

function criarContexto(user?: { sub?: string; perfil?: string }) {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as any;
}

describe('AccessStatusGuard', () => {
  const prisma = {
    usuario: {
      findUnique: jest.fn(),
    },
  };

  const reflector = {
    getAllAndOverride: jest.fn(),
  };

  let guard: AccessStatusGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new AccessStatusGuard(
      prisma as any,
      reflector as unknown as Reflector,
    );
    reflector.getAllAndOverride.mockReturnValue(true);
  });

  it('permite acesso quando a rota não exige restrição financeira', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);

    await expect(guard.canActivate(criarContexto())).resolves.toBe(true);

    expect(prisma.usuario.findUnique).not.toHaveBeenCalled();
  });

  it('rejeita usuário sem identidade autenticada', async () => {
    await expect(guard.canActivate(criarContexto())).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it.each(['ADMIN', 'ADMIN_BASICO'])(
    'permite o perfil da sede %s sem consultar a situação financeira',
    async (perfil) => {
      await expect(
        guard.canActivate(criarContexto({ sub: 'admin-1', perfil })),
      ).resolves.toBe(true);

      expect(prisma.usuario.findUnique).not.toHaveBeenCalled();
    },
  );

  it('permite associado adimplente sem bloqueio manual', async () => {
    prisma.usuario.findUnique.mockResolvedValue({
      ativo: true,
      associado: {
        situacao: 'ADIMPLENTE',
        acessoManual: null,
        inativadoEm: null,
      },
    });

    await expect(
      guard.canActivate(
        criarContexto({ sub: 'associado-1', perfil: 'ASSOCIADO' }),
      ),
    ).resolves.toBe(true);
  });

  it('bloqueia associado inadimplente sem liberação manual', async () => {
    prisma.usuario.findUnique.mockResolvedValue({
      ativo: true,
      associado: {
        situacao: 'INADIMPLENTE',
        acessoManual: null,
        inativadoEm: null,
      },
    });

    await expect(
      guard.canActivate(
        criarContexto({ sub: 'associado-1', perfil: 'ASSOCIADO' }),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('permite associado inadimplente liberado manualmente', async () => {
    prisma.usuario.findUnique.mockResolvedValue({
      ativo: true,
      associado: {
        situacao: 'INADIMPLENTE',
        acessoManual: 'LIBERADO',
        inativadoEm: null,
      },
    });

    await expect(
      guard.canActivate(
        criarContexto({ sub: 'associado-1', perfil: 'ASSOCIADO' }),
      ),
    ).resolves.toBe(true);
  });

  it('bloqueia associado adimplente bloqueado manualmente', async () => {
    prisma.usuario.findUnique.mockResolvedValue({
      ativo: true,
      associado: {
        situacao: 'ADIMPLENTE',
        acessoManual: 'BLOQUEADO',
        inativadoEm: null,
      },
    });

    await expect(
      guard.canActivate(
        criarContexto({ sub: 'associado-1', perfil: 'ASSOCIADO' }),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('bloqueia associado inativado', async () => {
    prisma.usuario.findUnique.mockResolvedValue({
      ativo: true,
      associado: {
        situacao: 'ADIMPLENTE',
        acessoManual: null,
        inativadoEm: new Date(),
      },
    });

    await expect(
      guard.canActivate(
        criarContexto({ sub: 'associado-1', perfil: 'ASSOCIADO' }),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('bloqueia usuário desativado', async () => {
    prisma.usuario.findUnique.mockResolvedValue({
      ativo: false,
      associado: {
        situacao: 'ADIMPLENTE',
        acessoManual: null,
        inativadoEm: null,
      },
    });

    await expect(
      guard.canActivate(
        criarContexto({ sub: 'associado-1', perfil: 'ASSOCIADO' }),
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});
