import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, randomInt, createHash } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { Prisma } from '../generated/prisma/client';
import {
  AssociateStatus,
  EmailOtpPurpose,
  RegistrationStatus,
  UserRole,
} from '../generated/prisma/enums';
import {
  DEFAULT_SESSION_TTL_MS,
  EMAIL_OTP_MAX_ATTEMPTS,
  EMAIL_OTP_MAX_RESENDS,
  EMAIL_OTP_TTL_MS,
  PASSWORD_RESET_TTL_MS,
  REMEMBERED_SESSION_TTL_MS,
} from './auth.constants';
import type { AuthenticatedUser } from './auth.types';
import { isValidCnpj, normalizeCnpj } from './cnpj';
import {
  EmailOtpDeliveryError,
  MailerService,
  PasswordResetDeliveryError,
} from './mailer.service';
import { PrismaService } from '../prisma/prisma.service';
import type { RegisterDto } from './dto/register.dto';
import type { VerifyEmailCodeDto } from './dto/verify-email-code.dto';

const DUMMY_PASSWORD_HASH = bcrypt.hashSync(
  randomBytes(32).toString('hex'),
  12,
);
const BCRYPT_MAX_PASSWORD_BYTES = 72;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mailer: MailerService,
  ) {}

  async login(
    email: string,
    password: string,
    rememberMe: boolean,
  ): Promise<
    | {
        requiresTwoFactor: true;
        challengeToken: string;
        maskedEmail: string;
        emailSent: boolean;
      }
    | {
        requiresTwoFactor: false;
        user: AuthenticatedUser;
        sessionToken: string;
        cookieMaxAge?: number;
      }
  > {
    if (Buffer.byteLength(password, 'utf8') > BCRYPT_MAX_PASSWORD_BYTES) {
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }

    const normalizedEmail = this.normalizeEmail(email);
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    const passwordMatches = await bcrypt.compare(
      password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );

    if (
      !user ||
      !user.isActive ||
      user.registrationStatus !== RegistrationStatus.APPROVED ||
      !passwordMatches
    ) {
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }

    if (this.isOtpBypassAllowed(normalizedEmail)) {
      const session = await this.createSession(user.id, rememberMe);
      return {
        requiresTwoFactor: false,
        user: this.toAuthenticatedUser(user),
        ...session,
      };
    }

    const challenge = await this.createEmailOtpChallenge(
      user.id,
      EmailOtpPurpose.LOGIN,
    );
    let emailSent = true;
    try {
      await this.mailer.sendEmailOtp(
        user.email,
        challenge.code,
        EmailOtpPurpose.LOGIN,
      );
    } catch (error) {
      if (!(error instanceof EmailOtpDeliveryError)) throw error;
      emailSent = false;
    }
    return {
      requiresTwoFactor: true,
      challengeToken: challenge.token,
      maskedEmail: this.maskEmail(user.email),
      emailSent,
    };
  }

  async register(dto: RegisterDto): Promise<{ message: string }> {
    const legalName = dto.legalName.trim();
    const tradeName = dto.tradeName?.trim() || null;
    const email = this.normalizeEmail(dto.email);
    const cnpj = normalizeCnpj(dto.cnpj);

    if (
      !legalName ||
      Buffer.byteLength(dto.password, 'utf8') > BCRYPT_MAX_PASSWORD_BYTES
    ) {
      throw new BadRequestException(
        'Informe dados válidos para criar sua conta.',
      );
    }
    if (!isValidCnpj(cnpj)) {
      throw new BadRequestException('Informe um CNPJ válido.');
    }

    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('Já existe uma conta com este e-mail.');
    }
    const existingCnpj = await this.prisma.associate.findUnique({
      where: { cnpj },
      select: { id: true },
    });
    if (existingCnpj) {
      throw new ConflictException(
        'Este CNPJ já possui uma solicitação ou conta.',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const requestedAt = new Date();
    try {
      await this.prisma.$transaction(async (transaction) => {
        const user = await transaction.user.create({
          data: {
            email,
            passwordHash,
            role: UserRole.ASSOCIATE,
            isActive: false,
            registrationStatus: RegistrationStatus.PENDING_APPROVAL,
            registrationRequestedAt: requestedAt,
            associate: {
              create: {
                cnpj,
                legalName,
                tradeName,
                status: AssociateStatus.INADIMPLENTE,
              },
            },
          },
          include: { associate: true },
        });

        await transaction.auditLog.create({
          data: {
            actorUserId: user.id,
            associateId: user.associate!.id,
            action: 'REGISTRATION_SUBMITTED',
            entity: 'User',
            entityId: user.id,
            previousValues: {},
            newValues: {
              email,
              legalName,
              tradeName,
              cnpj,
              registrationStatus: RegistrationStatus.PENDING_APPROVAL,
            },
          },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Já existe uma solicitação ou conta com este e-mail ou CNPJ.',
        );
      }
      throw error;
    }

    return {
      message:
        'Cadastro enviado para análise do administrador. Após a aprovação, você receberá um e-mail de confirmação e poderá entrar na área do associado.',
    };
  }

  async verifyEmailCode(dto: VerifyEmailCodeDto): Promise<
    | { purpose: 'REGISTRATION'; message: string }
    | {
        purpose: 'LOGIN';
        user: AuthenticatedUser;
        sessionToken: string;
        cookieMaxAge?: number;
      }
  > {
    const challenge = await this.prisma.emailOtpChallenge.findUnique({
      where: { tokenHash: this.hashToken(dto.challengeToken) },
      include: { user: true },
    });
    const now = new Date();
    if (
      !challenge ||
      challenge.consumedAt ||
      challenge.expiresAt <= now ||
      challenge.attempts >= EMAIL_OTP_MAX_ATTEMPTS
    ) {
      throw new BadRequestException(
        'Código inválido ou expirado. Solicite um novo código.',
      );
    }
    if (challenge.purpose === EmailOtpPurpose.REGISTRATION) {
      if (
        challenge.user.registrationStatus !== RegistrationStatus.PENDING_EMAIL
      ) {
        throw new BadRequestException(
          'Este código de confirmação já foi usado ou expirou.',
        );
      }
    } else if (
      !challenge.user.isActive ||
      challenge.user.registrationStatus !== RegistrationStatus.APPROVED
    ) {
      throw new BadRequestException(
        'Este código de acesso já foi usado ou expirou.',
      );
    }

    const codeMatches = await bcrypt.compare(dto.code, challenge.codeHash);
    if (!codeMatches) {
      await this.prisma.emailOtpChallenge.updateMany({
        where: {
          id: challenge.id,
          consumedAt: null,
          codeHash: challenge.codeHash,
          attempts: challenge.attempts,
        },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException(
        'Código inválido ou expirado. Confira o e-mail e tente novamente.',
      );
    }

    if (challenge.purpose === EmailOtpPurpose.REGISTRATION) {
      await this.prisma.$transaction(async (transaction) => {
        const claimed = await transaction.emailOtpChallenge.updateMany({
          where: {
            id: challenge.id,
            consumedAt: null,
            codeHash: challenge.codeHash,
            expiresAt: { gt: now },
            attempts: { lt: EMAIL_OTP_MAX_ATTEMPTS },
          },
          data: { consumedAt: now },
        });
        if (claimed.count !== 1) {
          throw new BadRequestException(
            'Código inválido ou expirado. Solicite um novo código.',
          );
        }
        const updated = await transaction.user.updateMany({
          where: {
            id: challenge.userId,
            registrationStatus: RegistrationStatus.PENDING_EMAIL,
          },
          data: { registrationStatus: RegistrationStatus.PENDING_APPROVAL },
        });
        if (updated.count !== 1) {
          throw new ConflictException(
            'O e-mail deste cadastro já foi confirmado.',
          );
        }
        const associate = await transaction.associate.findUnique({
          where: { userId: challenge.userId },
          select: { id: true },
        });
        await transaction.auditLog.create({
          data: {
            actorUserId: challenge.userId,
            associateId: associate?.id,
            action: 'REGISTRATION_EMAIL_VERIFIED',
            entity: 'User',
            entityId: challenge.userId,
            previousValues: {
              registrationStatus: RegistrationStatus.PENDING_EMAIL,
            },
            newValues: {
              registrationStatus: RegistrationStatus.PENDING_APPROVAL,
              emailVerifiedAt: now.toISOString(),
            },
          },
        });
      });
      return {
        purpose: 'REGISTRATION',
        message:
          'E-mail confirmado. Sua solicitação foi enviada para análise do administrador. Você receberá uma mensagem quando houver uma decisão.',
      };
    }

    const sessionToken = randomBytes(32).toString('base64url');
    const expiresIn = dto.rememberMe
      ? REMEMBERED_SESSION_TTL_MS
      : DEFAULT_SESSION_TTL_MS;
    await this.prisma.$transaction(async (transaction) => {
      const claimed = await transaction.emailOtpChallenge.updateMany({
        where: {
          id: challenge.id,
          consumedAt: null,
          codeHash: challenge.codeHash,
          expiresAt: { gt: now },
          attempts: { lt: EMAIL_OTP_MAX_ATTEMPTS },
        },
        data: { consumedAt: now },
      });
      if (claimed.count !== 1) {
        throw new BadRequestException(
          'Código inválido ou expirado. Solicite um novo código.',
        );
      }
      await transaction.authSession.create({
        data: {
          userId: challenge.userId,
          tokenHash: this.hashToken(sessionToken),
          expiresAt: new Date(Date.now() + expiresIn),
        },
      });
    });
    return {
      purpose: 'LOGIN',
      user: this.toAuthenticatedUser(challenge.user),
      sessionToken,
      ...(dto.rememberMe ? { cookieMaxAge: expiresIn } : {}),
    };
  }

  async resendEmailOtp(
    challengeToken: string,
  ): Promise<{ emailSent: boolean; message: string }> {
    const tokenHash = this.hashToken(challengeToken);
    const challenge = await this.prisma.emailOtpChallenge.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (
      !challenge ||
      challenge.consumedAt ||
      challenge.resends >= EMAIL_OTP_MAX_RESENDS ||
      (challenge.purpose === EmailOtpPurpose.REGISTRATION &&
        challenge.user.registrationStatus !==
          RegistrationStatus.PENDING_EMAIL) ||
      (challenge.purpose === EmailOtpPurpose.LOGIN &&
        (!challenge.user.isActive ||
          challenge.user.registrationStatus !== RegistrationStatus.APPROVED))
    ) {
      throw new BadRequestException(
        'Não foi possível reenviar o código. Inicie o processo novamente.',
      );
    }

    const code = this.createOtpCode();
    const codeHash = await bcrypt.hash(code, 8);
    const expiresAt = new Date(Date.now() + EMAIL_OTP_TTL_MS);
    const updated = await this.prisma.emailOtpChallenge.updateMany({
      where: {
        id: challenge.id,
        consumedAt: null,
        attempts: { lt: EMAIL_OTP_MAX_ATTEMPTS },
        resends: { lt: EMAIL_OTP_MAX_RESENDS },
      },
      data: { codeHash, expiresAt, attempts: 0, resends: { increment: 1 } },
    });
    if (updated.count !== 1) {
      throw new ConflictException(
        'Este código já foi usado. Inicie o processo novamente.',
      );
    }

    try {
      await this.mailer.sendEmailOtp(
        challenge.user.email,
        code,
        challenge.purpose,
      );
      return {
        emailSent: true,
        message: 'Enviamos um novo código para seu e-mail.',
      };
    } catch (error) {
      if (error instanceof EmailOtpDeliveryError) {
        return {
          emailSent: false,
          message:
            'Não foi possível enviar o código. Verifique a configuração de e-mail e tente novamente.',
        };
      }
      throw error;
    }
  }

  private async createEmailOtpChallenge(
    userId: string,
    purpose: EmailOtpPurpose,
  ) {
    const token = randomBytes(32).toString('base64url');
    const code = this.createOtpCode();
    const codeHash = await bcrypt.hash(code, 8);
    await this.prisma.$transaction(async (transaction) => {
      await transaction.emailOtpChallenge.updateMany({
        where: { userId, purpose, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      await transaction.emailOtpChallenge.create({
        data: {
          userId,
          tokenHash: this.hashToken(token),
          codeHash,
          purpose,
          expiresAt: new Date(Date.now() + EMAIL_OTP_TTL_MS),
        },
      });
    });
    return { token, code };
  }

  private createOtpCode() {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  private maskEmail(email: string) {
    const [localPart, domain] = email.split('@');
    const visible = localPart?.slice(0, 1) ?? '';
    return `${visible}${'*'.repeat(Math.max(3, (localPart?.length ?? 1) - 1))}@${domain}`;
  }

  private isOtpBypassAllowed(email: string): boolean {
    const environment = this.config.get<string>('NODE_ENV');
    if (environment !== 'development' && environment !== 'test') {
      return false;
    }
    const allowedEmails = this.config
      .get<string>('AUTH_OTP_BYPASS_EMAILS')
      ?.split(',')
      .map((value) => this.normalizeEmail(value))
      .filter(Boolean);
    return allowedEmails?.includes(email) ?? false;
  }

  private async createSession(userId: string, rememberMe: boolean) {
    const sessionToken = randomBytes(32).toString('base64url');
    const expiresIn = rememberMe
      ? REMEMBERED_SESSION_TTL_MS
      : DEFAULT_SESSION_TTL_MS;
    await this.prisma.authSession.create({
      data: {
        userId,
        tokenHash: this.hashToken(sessionToken),
        expiresAt: new Date(Date.now() + expiresIn),
      },
    });
    return {
      sessionToken,
      ...(rememberMe ? { cookieMaxAge: expiresIn } : {}),
    };
  }

  async logout(sessionToken?: string): Promise<void> {
    if (!sessionToken) {
      return;
    }

    await this.prisma.authSession.updateMany({
      where: {
        tokenHash: this.hashToken(sessionToken),
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  async getSessionUser(sessionToken: string): Promise<{
    user: AuthenticatedUser;
    sessionId: string;
  } | null> {
    const session = await this.prisma.authSession.findUnique({
      where: { tokenHash: this.hashToken(sessionToken) },
      include: { user: true },
    });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      !session.user.isActive
    ) {
      return null;
    }

    return {
      user: this.toAuthenticatedUser(session.user),
      sessionId: session.id,
    };
  }

  async requestPasswordReset(email: string): Promise<void> {
    this.mailer.assertConfigured();
    const webOrigin = this.getPasswordResetOrigin();
    const user = await this.prisma.user.findUnique({
      where: { email: this.normalizeEmail(email) },
    });
    if (!user || !user.isActive) {
      return;
    }

    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
    await this.prisma.$transaction(async (transaction) => {
      await transaction.passwordResetToken.deleteMany({
        where: { userId: user.id, usedAt: null },
      });
      await transaction.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt },
      });
    });

    const resetUrl = new URL('/redefinir-senha', webOrigin);
    resetUrl.searchParams.set('token', rawToken);

    try {
      await this.mailer.sendPasswordReset(user.email, resetUrl.toString());
    } catch (error) {
      await this.prisma.passwordResetToken.deleteMany({
        where: { tokenHash, usedAt: null },
      });
      if (error instanceof PasswordResetDeliveryError) {
        this.logger.warn(
          'Solicitação de recuperação aceita sem confirmar a entrega do e-mail.',
        );
        return;
      }
      throw error;
    }
  }

  async resetPassword(token: string, password: string): Promise<void> {
    if (Buffer.byteLength(password, 'utf8') > BCRYPT_MAX_PASSWORD_BYTES) {
      throw new BadRequestException(
        'A senha deve ter no máximo 72 bytes em UTF-8.',
      );
    }

    const tokenHash = this.hashToken(token);
    const passwordHash = await bcrypt.hash(password, 12);
    await this.prisma.$transaction(async (transaction) => {
      const reset = await transaction.passwordResetToken.findUnique({
        where: { tokenHash },
      });
      if (!reset || reset.usedAt || reset.expiresAt <= new Date()) {
        throw new BadRequestException(
          'Link de recuperação inválido ou expirado.',
        );
      }

      const claimed = await transaction.passwordResetToken.updateMany({
        where: {
          id: reset.id,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date() },
      });
      if (claimed.count !== 1) {
        throw new BadRequestException(
          'Link de recuperação inválido ou expirado.',
        );
      }

      await transaction.user.update({
        where: { id: reset.userId },
        data: { passwordHash },
      });
      await transaction.authSession.updateMany({
        where: { userId: reset.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await transaction.passwordResetToken.deleteMany({
        where: { userId: reset.userId, usedAt: null },
      });
    });
    this.logger.log('Senha redefinida; sessões existentes foram revogadas.');
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private getPasswordResetOrigin(): string {
    const configuredValue = this.config.get<string>('WEB_ORIGIN')?.trim();
    const configuredOrigin =
      configuredValue ||
      (this.config.get<string>('NODE_ENV') === 'production'
        ? ''
        : 'http://localhost:5173');
    let parsedOrigin: URL;
    try {
      parsedOrigin = new URL(configuredOrigin);
    } catch {
      throw new ServiceUnavailableException(
        'A origem da aplicação web não está configurada corretamente.',
      );
    }

    if (
      parsedOrigin.origin !== configuredOrigin.replace(/\/+$/, '') ||
      (this.config.get<string>('NODE_ENV') === 'production' &&
        parsedOrigin.protocol !== 'https:')
    ) {
      throw new ServiceUnavailableException(
        'A origem de redefinição deve ser HTTPS em produção.',
      );
    }
    return parsedOrigin.origin;
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private toAuthenticatedUser(user: {
    id: string;
    email: string;
    role: AuthenticatedUser['role'];
  }): AuthenticatedUser {
    return { id: user.id, email: user.email, role: user.role };
  }
}
