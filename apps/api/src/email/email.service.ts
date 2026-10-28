import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

@Injectable()
export class EmailService implements OnModuleDestroy {
  private readonly logger = new Logger(EmailService.name);
  private transporter?: Transporter;

  constructor(private readonly config: ConfigService) {}

  async send(message: EmailMessage): Promise<void> {
    // Só na demonstração, que não tem SMTP (docs/deploy.md): o e-mail vai para
    // o log, com os links. Nunca ligar no sistema do cliente.
    if (this.config.get<string>('EMAIL_SO_NO_LOG') === 'true') {
      this.logger.log(
        `E-mail não enviado (EMAIL_SO_NO_LOG=true). Para: ${message.to}. Assunto: ${message.subject}.\n${message.text}`,
      );
      return;
    }

    const transporter = this.getTransporter();
    const from = this.config.get<string>('SMTP_FROM');

    if (!from) {
      throw new InternalServerErrorException(
        'Configuração ausente: SMTP_FROM.',
      );
    }

    await transporter.sendMail({ ...message, from });
  }

  onModuleDestroy(): void {
    this.transporter?.close();
  }

  private getTransporter(): Transporter {
    if (this.transporter) {
      return this.transporter;
    }

    const host = this.config.get<string>('SMTP_HOST');
    const portValue = this.config.get<string>('SMTP_PORT');
    const secureValue = this.config.get<string>('SMTP_SECURE');
    const user = this.config.get<string>('SMTP_USER');
    const password = this.config.get<string>('SMTP_PASSWORD');

    if (!host || !portValue) {
      throw new InternalServerErrorException(
        'Configuração ausente: SMTP_HOST e SMTP_PORT.',
      );
    }

    const port = Number(portValue);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new InternalServerErrorException('SMTP_PORT inválida.');
    }

    if (secureValue !== 'true' && secureValue !== 'false') {
      throw new InternalServerErrorException(
        'SMTP_SECURE deve ser "true" ou "false".',
      );
    }

    if (Boolean(user) !== Boolean(password)) {
      throw new InternalServerErrorException(
        'SMTP_USER e SMTP_PASSWORD devem ser configurados juntos.',
      );
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: secureValue === 'true',
      ...(user && password ? { auth: { user, pass: password } } : {}),
    });

    return this.transporter;
  }
}
