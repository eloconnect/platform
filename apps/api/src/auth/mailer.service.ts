import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

export class PasswordResetDeliveryError extends Error {
  constructor() {
    super('Password reset e-mail delivery failed.');
    this.name = 'PasswordResetDeliveryError';
  }
}

export class WelcomeEmailDeliveryError extends Error {
  constructor() {
    super('Welcome e-mail delivery failed.');
    this.name = 'WelcomeEmailDeliveryError';
  }
}

export class EmailOtpDeliveryError extends Error {
  constructor() {
    super('Email verification code delivery failed.');
    this.name = 'EmailOtpDeliveryError';
  }
}

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private transporter?: Transporter;

  constructor(private readonly config: ConfigService) {}

  assertConfigured(): void {
    this.getTransporter();
  }

  async sendPasswordReset(email: string, resetUrl: string): Promise<void> {
    const from = this.config.get<string>('SMTP_FROM');
    if (!from) {
      throw new ServiceUnavailableException(
        'O serviço de recuperação de senha está indisponível.',
      );
    }

    try {
      await this.getTransporter().sendMail({
        from,
        to: email,
        subject: 'Redefinição de senha - Elo Connect',
        text: `Use este link para criar uma nova senha (válido por 60 minutos): ${resetUrl}`,
        html: `<p>Use o link abaixo para criar uma nova senha. Ele é válido por 60 minutos.</p><p><a href="${resetUrl}">Criar nova senha</a></p>`,
      });
    } catch (error) {
      this.logger.error(
        'Não foi possível enviar a mensagem de redefinição de senha.',
        error instanceof Error ? error.name : 'Unknown error',
      );
      throw new PasswordResetDeliveryError();
    }
  }

  async sendWelcome(email: string, legalName: string): Promise<void> {
    try {
      const from = this.config.get<string>('SMTP_FROM');
      if (!from) {
        throw new ServiceUnavailableException(
          'O serviço de e-mail de boas-vindas não está configurado.',
        );
      }
      const loginUrl = new URL('/login', this.getWebOrigin()).toString();
      const safeLegalName = this.escapeHtml(legalName);
      await this.getTransporter().sendMail({
        from,
        to: email,
        subject: 'Cadastro da farmácia aprovado - Elo Connect',
        text: `Olá. O cadastro da farmácia ${legalName} foi aprovado e o acesso ao Elo Connect está liberado. Entre com o e-mail cadastrado e sua senha. Um código de verificação será enviado ao seu e-mail para concluir o acesso: ${loginUrl}`,
        html: `<p>Olá.</p><p>O cadastro da farmácia <strong>${safeLegalName}</strong> foi aprovado e o acesso ao Elo Connect está liberado. Seja bem-vindo(a)!</p><p>Entre com o e-mail cadastrado e sua senha. Para sua segurança, enviaremos um código de verificação ao seu e-mail para concluir o acesso.</p><p><a href="${loginUrl}">Acessar o Elo Connect</a></p>`,
      });
    } catch (error) {
      this.logger.error(
        'Não foi possível enviar o e-mail de boas-vindas.',
        error instanceof Error ? error.name : 'Unknown error',
      );
      throw new WelcomeEmailDeliveryError();
    }
  }

  async sendEmailOtp(
    email: string,
    code: string,
    purpose: 'LOGIN' | 'REGISTRATION',
  ): Promise<void> {
    const registration = purpose === 'REGISTRATION';
    try {
      const from = this.config.get<string>('SMTP_FROM');
      if (!from) {
        throw new ServiceUnavailableException(
          'O serviço de verificação por e-mail não está configurado.',
        );
      }
      const action = registration
        ? 'confirmar seu e-mail e enviar o cadastro para aprovação'
        : 'concluir seu acesso ao Elo Connect';
      const subject = registration
        ? 'Confirme seu e-mail - Elo Connect'
        : 'Código de acesso - Elo Connect';
      await this.getTransporter().sendMail({
        from,
        to: email,
        subject,
        text: `Seu código para ${action} é ${code}. Ele expira em 10 minutos. Se você não solicitou esse código, ignore esta mensagem.`,
        html: `<p>Use este código para ${action}:</p><p style="font-size:28px;font-weight:bold;letter-spacing:8px">${code}</p><p>O código expira em 10 minutos. Se você não solicitou este código, ignore esta mensagem.</p>`,
      });
    } catch (error) {
      this.logger.error(
        'Não foi possível enviar um código de verificação por e-mail.',
        error instanceof Error ? error.name : 'Unknown error',
      );
      throw new EmailOtpDeliveryError();
    }
  }

  private getTransporter(): Transporter {
    if (this.transporter) {
      return this.transporter;
    }

    const host = this.config.get<string>('SMTP_HOST');
    const from = this.config.get<string>('SMTP_FROM');
    if (!host || !from) {
      throw new ServiceUnavailableException(
        'O serviço de recuperação de senha não está configurado.',
      );
    }

    const port = Number(this.config.get<string>('SMTP_PORT') ?? 587);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new ServiceUnavailableException(
        'A porta do servidor de e-mail está configurada incorretamente.',
      );
    }

    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASSWORD');
    if (Boolean(user) !== Boolean(pass)) {
      throw new ServiceUnavailableException(
        'As credenciais do servidor de e-mail estão incompletas.',
      );
    }
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: this.config.get<string>('SMTP_SECURE') === 'true',
      ...(user && pass ? { auth: { user, pass } } : {}),
    });
    return this.transporter;
  }

  private getWebOrigin(): string {
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
        'A origem do e-mail de boas-vindas deve ser HTTPS em produção.',
      );
    }
    return parsedOrigin.origin;
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (character) => {
      const entities: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      };
      return entities[character];
    });
  }
}
