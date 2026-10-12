import { Test, type TestingModule } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import { createHash } from 'node:crypto';
import { Perfil } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const password = 'SenhaForte123!';
  let passwordHash: string;
  let service: AuthService;
  let module: TestingModule;
  let prisma: {
    usuario: { findUnique: jest.Mock };
    sessaoAutenticacao: {
      create: jest.Mock;
      findFirst: jest.Mock;
      deleteMany: jest.Mock;
    };
  };

  beforeAll(async () => {
    passwordHash = await hash(password);
  });

  beforeEach(async () => {
    prisma = {
      usuario: { findUnique: jest.fn() },
      sessaoAutenticacao: {
        create: jest.fn().mockResolvedValue({ id: 'session-id' }),
        findFirst: jest.fn(),
        deleteMany: jest.fn(),
      },
    };
    module = await Test.createTestingModule({
      providers: [AuthService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(AuthService);
  });

  afterEach(async () => {
    await module.close();
  });

  it('cria uma sessão persistindo somente o hash do token', async () => {
    prisma.usuario.findUnique.mockResolvedValue({
      id: 'user-id',
      email: 'admin@example.com',
      nome: 'Admin',
      senhaHash: passwordHash,
      perfil: Perfil.ADMIN,
      ativo: true,
    });

    const result = await service.login('admin@example.com', password);

    expect(result.user).toEqual({
      id: 'user-id',
      email: 'admin@example.com',
      nome: 'Admin',
      perfil: Perfil.ADMIN,
    });
    expect(result.token).toHaveLength(43);
    expect(prisma.sessaoAutenticacao.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        usuarioId: 'user-id',
        tokenHash: createHash('sha256').update(result.token).digest('hex'),
        expiraEm: expect.any(Date),
      }),
      select: { id: true },
    });
    expect(
      JSON.stringify(prisma.sessaoAutenticacao.create.mock.calls),
    ).not.toContain(result.token);
  });

  it('nega credenciais inválidas sem revelar se a conta existe', async () => {
    prisma.usuario.findUnique.mockResolvedValue(null);

    await expect(
      service.login('ausente@example.com', password),
    ).rejects.toThrow('E-mail ou senha inválidos.');
    expect(prisma.sessaoAutenticacao.create).not.toHaveBeenCalled();
  });

  it('nega senha incorreta e usuários inativos', async () => {
    prisma.usuario.findUnique
      .mockResolvedValueOnce({
        id: 'user-id',
        email: 'admin@example.com',
        nome: 'Admin',
        senhaHash: passwordHash,
        perfil: Perfil.ADMIN,
        ativo: true,
      })
      .mockResolvedValueOnce({
        id: 'user-id',
        email: 'admin@example.com',
        nome: 'Admin',
        senhaHash: passwordHash,
        perfil: Perfil.ADMIN,
        ativo: false,
      });

    await expect(
      service.login('admin@example.com', 'senha-errada'),
    ).rejects.toThrow('E-mail ou senha inválidos.');
    await expect(service.login('admin@example.com', password)).rejects.toThrow(
      'E-mail ou senha inválidos.',
    );
    expect(prisma.sessaoAutenticacao.create).not.toHaveBeenCalled();
  });

  it('valida sessão pelo hash do cookie e revoga no logout', async () => {
    const token = 'opaque-session-token';
    prisma.sessaoAutenticacao.findFirst.mockResolvedValue({
      id: 'session-id',
      usuario: {
        id: 'user-id',
        email: 'associado@example.com',
        nome: 'Associado',
        perfil: Perfil.ASSOCIADO,
      },
    });

    await expect(service.getSession(token)).resolves.toEqual({
      sessionId: 'session-id',
      user: {
        id: 'user-id',
        email: 'associado@example.com',
        nome: 'Associado',
        perfil: Perfil.ASSOCIADO,
      },
    });
    expect(prisma.sessaoAutenticacao.findFirst).toHaveBeenCalledWith({
      where: {
        tokenHash: createHash('sha256').update(token).digest('hex'),
        expiraEm: { gt: expect.any(Date) },
        usuario: { ativo: true },
      },
      include: { usuario: true },
    });

    await service.logout(token);
    expect(prisma.sessaoAutenticacao.deleteMany).toHaveBeenCalledWith({
      where: {
        tokenHash: createHash('sha256').update(token).digest('hex'),
      },
    });
  });
});
