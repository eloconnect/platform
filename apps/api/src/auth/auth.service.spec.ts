import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';
import {
  AssociateStatus,
  RegistrationStatus,
  UserRole,
} from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { isValidCnpj } from './cnpj';
import { MailerService } from './mailer.service';

describe('AuthService', () => {
  const user = {
    id: 'user-1',
    email: 'member@example.com',
    passwordHash: '',
    role: UserRole.ASSOCIATE,
    isActive: true,
    registrationStatus: RegistrationStatus.APPROVED,
  };
  const transaction = {
    user: { create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    associate: { findUnique: jest.fn() },
    auditLog: { create: jest.fn() },
    emailOtpChallenge: { create: jest.fn(), updateMany: jest.fn() },
    passwordResetToken: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      create: jest.fn(),
    },
    authSession: { create: jest.fn(), updateMany: jest.fn() },
  };
  const prisma = {
    user: { findUnique: jest.fn() },
    associate: { findUnique: jest.fn() },
    emailOtpChallenge: { findUnique: jest.fn(), updateMany: jest.fn() },
    authSession: { create: jest.fn(), updateMany: jest.fn() },
    passwordResetToken: { deleteMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const mailer = {
    assertConfigured: jest.fn(),
    sendPasswordReset: jest.fn(),
    sendEmailOtp: jest.fn(),
  };
  const config = {
    get: jest.fn((key: string) =>
      key === 'WEB_ORIGIN' ? 'http://localhost:5173' : undefined,
    ),
  };
  let service: AuthService;

  beforeAll(async () => {
    user.passwordHash = await bcrypt.hash('ValidPassword123', 4);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    config.get.mockImplementation((key) =>
      key === 'WEB_ORIGIN' ? 'http://localhost:5173' : undefined,
    );
    service = new AuthService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
      mailer as unknown as MailerService,
    );
  });

  it('validates Brazilian company registration numbers', () => {
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true);
    expect(isValidCnpj('11.222.333/0001-80')).toBe(false);
    expect(isValidCnpj('00.000.000/0000-00')).toBe(false);
  });

  it('queues public registrations immediately for admin approval', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.associate.findUnique.mockResolvedValue(null);
    prisma.$transaction.mockImplementation(
      (callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    );
    transaction.user.create.mockResolvedValue({
      id: 'pending-user-1',
      associate: { id: 'pending-associate-1' },
    });
    const result = await service.register({
      legalName: ' Farmácia Exemplo Ltda. ',
      tradeName: ' Exemplo ',
      cnpj: '11.222.333/0001-81',
      email: ' NOVO@EXEMPLO.COM ',
      password: 'ValidPassword123',
    });

    expect(result).toMatchObject({
      message: expect.stringContaining('análise do administrador'),
    });
    expect(transaction.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'novo@exemplo.com',
        role: UserRole.ASSOCIATE,
        isActive: false,
        registrationStatus: RegistrationStatus.PENDING_APPROVAL,
        associate: {
          create: {
            cnpj: '11222333000181',
            legalName: 'Farmácia Exemplo Ltda.',
            tradeName: 'Exemplo',
            status: AssociateStatus.INADIMPLENTE,
          },
        },
      }),
      include: { associate: true },
    });
    expect(transaction.emailOtpChallenge.create).not.toHaveBeenCalled();
    expect(mailer.sendEmailOtp).not.toHaveBeenCalled();
  });

  it('starts e-mail two-factor login without creating a session', async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.$transaction.mockImplementation(
      (callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    );
    transaction.emailOtpChallenge.create.mockResolvedValue({ id: 'otp-2' });

    const result = await service.login(
      ' MEMBER@EXAMPLE.COM ',
      'ValidPassword123',
      false,
    );

    expect(result).toMatchObject({
      requiresTwoFactor: true,
      maskedEmail: 'm*****@example.com',
      emailSent: true,
    });
    expect(result.challengeToken).toHaveLength(43);
    expect(transaction.emailOtpChallenge.create).toHaveBeenCalled();
    expect(prisma.authSession.create).not.toHaveBeenCalled();
    expect(mailer.sendEmailOtp.mock.calls[0]?.[1]).toMatch(/^\d{6}$/);
  });

  it('skips OTP for explicitly allowlisted test emails in local development', async () => {
    config.get.mockImplementation((key) => {
      if (key === 'NODE_ENV') return 'development';
      if (key === 'AUTH_OTP_BYPASS_EMAILS') return ' member@example.com ';
      return undefined;
    });
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.authSession.create.mockResolvedValue({ id: 'session-test' });

    const result = await service.login(
      ' MEMBER@EXAMPLE.COM ',
      'ValidPassword123',
      true,
    );

    expect(result).toMatchObject({
      requiresTwoFactor: false,
      user: { id: user.id, role: UserRole.ASSOCIATE },
      cookieMaxAge: 30 * 24 * 60 * 60 * 1000,
    });
    expect(prisma.authSession.create).toHaveBeenCalled();
    expect(mailer.sendEmailOtp).not.toHaveBeenCalled();
  });

  it('never skips OTP for an allowlisted email in production', async () => {
    config.get.mockImplementation((key) => {
      if (key === 'NODE_ENV') return 'production';
      if (key === 'AUTH_OTP_BYPASS_EMAILS') return 'member@example.com';
      return undefined;
    });
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.$transaction.mockImplementation(
      (callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    );
    transaction.emailOtpChallenge.create.mockResolvedValue({ id: 'otp-prod' });

    const result = await service.login(user.email, 'ValidPassword123', false);

    expect(result).toMatchObject({ requiresTwoFactor: true });
    expect(prisma.authSession.create).not.toHaveBeenCalled();
  });

  it('creates a session only after a valid one-time login code', async () => {
    const challengeToken = 'a'.repeat(43);
    prisma.emailOtpChallenge.findUnique.mockResolvedValue({
      id: 'otp-login',
      userId: user.id,
      purpose: 'LOGIN',
      codeHash: await bcrypt.hash('123456', 4),
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 0,
      consumedAt: null,
      user,
    });
    prisma.$transaction.mockImplementation(
      (callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    );
    transaction.emailOtpChallenge.updateMany.mockResolvedValue({ count: 1 });
    transaction.authSession.create.mockResolvedValue({ id: 'session-1' });

    const result = await service.verifyEmailCode({
      challengeToken,
      code: '123456',
      rememberMe: true,
    });

    expect(result.purpose).toBe('LOGIN');
    if (result.purpose !== 'LOGIN') {
      throw new Error('Expected a login authentication result.');
    }
    expect(result.user).toEqual({
      id: user.id,
      email: user.email,
      role: user.role,
    });
    expect(result.cookieMaxAge).toBe(30 * 24 * 60 * 60 * 1000);
    expect(transaction.authSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: user.id,
        tokenHash: createHash('sha256')
          .update(result.sessionToken)
          .digest('hex'),
      }),
    });
  });

  it('moves a registration to admin approval only after e-mail confirmation', async () => {
    const challengeToken = 'd'.repeat(43);
    const registrationUser = {
      ...user,
      id: 'pending-user',
      isActive: false,
      registrationStatus: RegistrationStatus.PENDING_EMAIL,
    };
    prisma.emailOtpChallenge.findUnique.mockResolvedValue({
      id: 'otp-registration',
      userId: registrationUser.id,
      purpose: 'REGISTRATION',
      codeHash: await bcrypt.hash('234567', 4),
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 0,
      consumedAt: null,
      user: registrationUser,
    });
    prisma.$transaction.mockImplementation(
      (callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    );
    transaction.emailOtpChallenge.updateMany.mockResolvedValue({ count: 1 });
    transaction.user.updateMany.mockResolvedValue({ count: 1 });
    transaction.associate.findUnique.mockResolvedValue({ id: 'associate-1' });
    transaction.auditLog.create.mockResolvedValue({ id: 'audit-1' });

    await expect(
      service.verifyEmailCode({
        challengeToken,
        code: '234567',
        rememberMe: false,
      }),
    ).resolves.toMatchObject({ purpose: 'REGISTRATION' });

    expect(transaction.user.updateMany).toHaveBeenCalledWith({
      where: {
        id: registrationUser.id,
        registrationStatus: RegistrationStatus.PENDING_EMAIL,
      },
      data: { registrationStatus: RegistrationStatus.PENDING_APPROVAL },
    });
    expect(transaction.authSession.create).not.toHaveBeenCalled();
    expect(transaction.auditLog.create).toHaveBeenCalled();
  });

  it('rejects an invalid login code without creating a session', async () => {
    const challengeToken = 'b'.repeat(43);
    prisma.emailOtpChallenge.findUnique.mockResolvedValue({
      id: 'otp-invalid',
      userId: user.id,
      purpose: 'LOGIN',
      codeHash: await bcrypt.hash('123456', 4),
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 0,
      consumedAt: null,
      user,
    });
    prisma.emailOtpChallenge.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      service.verifyEmailCode({
        challengeToken,
        code: '654321',
        rememberMe: false,
      }),
    ).rejects.toThrow('Código inválido');
    expect(prisma.emailOtpChallenge.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'otp-invalid',
        consumedAt: null,
        codeHash: expect.any(String),
        attempts: 0,
      },
      data: { attempts: { increment: 1 } },
    });
    expect(prisma.authSession.create).not.toHaveBeenCalled();
  });

  it('rejects invalid credentials without creating a session', async () => {
    prisma.user.findUnique.mockResolvedValue(user);

    await expect(
      service.login(user.email, 'wrong-password', false),
    ).rejects.toThrow(UnauthorizedException);
    expect(prisma.authSession.create).not.toHaveBeenCalled();
  });

  it('returns the same recovery outcome for an unknown e-mail', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.requestPasswordReset('unknown@example.com'),
    ).resolves.toBeUndefined();

    expect(mailer.assertConfigured).toHaveBeenCalled();
    expect(mailer.sendPasswordReset).not.toHaveBeenCalled();
  });

  it('sends a reset link while storing only its expiring token hash', async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.$transaction.mockImplementation(
      (callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    );
    transaction.passwordResetToken.deleteMany.mockResolvedValue({ count: 0 });
    transaction.passwordResetToken.create.mockResolvedValue({ id: 'reset-2' });
    mailer.sendPasswordReset.mockResolvedValue(undefined);

    await service.requestPasswordReset(user.email);

    const createCall = transaction.passwordResetToken.create.mock.calls[0]?.[0];
    const storedTokenHash = createCall.data.tokenHash;
    const expiresAt = createCall.data.expiresAt;
    const [recipient, resetLink] = mailer.sendPasswordReset.mock.calls[0] ?? [];
    if (!recipient || !resetLink) {
      throw new Error('Expected a password reset e-mail to be sent.');
    }
    const rawToken = new URL(resetLink).searchParams.get('token');
    if (!rawToken) {
      throw new Error('Expected the reset link to contain a token.');
    }
    expect(recipient).toBe(user.email);
    expect(storedTokenHash).toBe(
      createHash('sha256').update(rawToken).digest('hex'),
    );
    expect(storedTokenHash).not.toBe(rawToken);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('revokes active sessions after a valid one-time password reset', async () => {
    const resetToken = {
      id: 'reset-1',
      userId: user.id,
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    };
    prisma.$transaction.mockImplementation(
      (callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    );
    transaction.passwordResetToken.findUnique.mockResolvedValue(resetToken);
    transaction.passwordResetToken.updateMany.mockResolvedValue({ count: 1 });
    transaction.user.update.mockResolvedValue(user);
    transaction.authSession.updateMany.mockResolvedValue({ count: 1 });
    transaction.passwordResetToken.deleteMany.mockResolvedValue({ count: 0 });

    await service.resetPassword('c'.repeat(43), 'NewValidPassword123');

    expect(transaction.user.update).toHaveBeenCalledWith({
      where: { id: user.id },
      data: { passwordHash: expect.any(String) },
    });
    expect(transaction.authSession.updateMany).toHaveBeenCalledWith({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});
