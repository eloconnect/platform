import { jest } from '@jest/globals';
import { InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { EmailService } from './email.service.js';

describe('EmailService', () => {
  const sendMail = jest.fn();
  const close = jest.fn();
  const createTransport = jest.spyOn(nodemailer, 'createTransport');
  let values: Record<string, string>;
  let service: EmailService;

  beforeEach(() => {
    jest.clearAllMocks();
    values = {
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '587',
      SMTP_SECURE: 'false',
      SMTP_FROM: 'Elo Connect <nao-responda@example.com>',
    };
    createTransport.mockReturnValue({
      sendMail,
      close,
    } as unknown as Transporter); // oxlint-disable-line typescript(no-unsafe-type-assertion)
    service = new EmailService({
      get: (key: string) => values[key],
    } as unknown as ConfigService); // oxlint-disable-line typescript(no-unsafe-type-assertion)
  });

  afterAll(() => {
    createTransport.mockRestore();
  });

  it('envia mensagem usando o SMTP configurado', async () => {
    await service.send({
      to: 'associado@example.com',
      subject: 'Aviso',
      text: 'Mensagem de teste',
    });

    expect(createTransport).toHaveBeenCalledWith({
      host: 'smtp.example.com',
      port: 587,
      secure: false,
    });
    expect(sendMail).toHaveBeenCalledWith({
      to: 'associado@example.com',
      subject: 'Aviso',
      text: 'Mensagem de teste',
      from: 'Elo Connect <nao-responda@example.com>',
    });
  });

  it('envia os anexos, como o PDF do boleto', async () => {
    const anexo = {
      filename: 'boleto-2026-12.pdf',
      content: Buffer.from('%PDF-1.4'),
      contentType: 'application/pdf',
    };

    await service.send({
      to: 'associado@example.com',
      subject: 'Boleto',
      text: 'Segue o boleto.',
      attachments: [anexo],
    });

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ attachments: [anexo] }),
    );
  });

  it('informa erro quando a configuração SMTP está ausente', async () => {
    delete values.SMTP_HOST;

    await expect(
      service.send({
        to: 'associado@example.com',
        subject: 'Aviso',
        text: 'Mensagem de teste',
      }),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
    expect(createTransport).not.toHaveBeenCalled();
  });

  it('com EMAIL_SO_NO_LOG=true, escreve no log e não usa o SMTP', async () => {
    const log = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    values = { EMAIL_SO_NO_LOG: 'true' };

    await service.send({
      to: 'associado@example.com',
      subject: 'Aviso',
      text: 'Link: https://app.example.com/criar-senha?token=abc',
    });

    expect(createTransport).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('https://app.example.com/criar-senha?token=abc'),
    );
    log.mockRestore();
  });

  it('com EMAIL_SO_NO_LOG=true, o log diz o nome dos anexos', async () => {
    const log = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    values = { EMAIL_SO_NO_LOG: 'true' };

    await service.send({
      to: 'associado@example.com',
      subject: 'Boleto',
      text: 'Segue o boleto.',
      attachments: [
        {
          filename: 'boleto-2026-12.pdf',
          content: Buffer.from('%PDF-1.4'),
          contentType: 'application/pdf',
        },
        {
          filename: 'qr-code-pix.gif',
          content: Buffer.from('GIF87a'),
          contentType: 'image/gif',
        },
      ],
    });

    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('Anexos: boleto-2026-12.pdf, qr-code-pix.gif.'),
    );
    log.mockRestore();
  });
});
