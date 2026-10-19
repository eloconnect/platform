import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { EmailService } from './email.service';

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
});
