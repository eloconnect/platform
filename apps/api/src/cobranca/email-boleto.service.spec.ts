import { jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import type { EmailMessage, EmailService } from '../email/email.service.js';
import { Prisma } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { EmailBoletoService } from './email-boleto.service.js';
import { GatewaySimulado } from './gateway-simulado.js';

const BOLETO = {
  id: 'boleto-id',
  competencia: new Date('2026-12-01'),
  valor: new Prisma.Decimal('130.00'),
  vencimento: new Date('2026-12-10'),
  sicrediNossoNumero: 'SIM000000000123',
  linhaDigitavel: '74891.00000 00000.000001 230000.000000 0 00000000013000',
  pixCopiaECola: '00020101-pix-simulado-SIM000000000123',
  associado: {
    cnpj: '41015838000136',
    razaoSocial: 'Farmácia Exemplo 01 Ltda',
    nomeFantasia: 'Farmácia <Exemplo> & Cia',
    email: 'farmacia01@example.com',
  },
};

describe('EmailBoletoService', () => {
  const findUniqueOrThrow = jest.fn<(args: unknown) => Promise<unknown>>();
  const update = jest.fn<(args: unknown) => Promise<unknown>>();
  const send = jest.fn<(mensagem: EmailMessage) => Promise<void>>();
  const service = new EmailBoletoService(
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    { boleto: { findUniqueOrThrow, update } } as unknown as PrismaService,
    new GatewaySimulado(),
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    { send } as unknown as EmailService,
    new ConfigService({ WEB_URL: 'https://app.example.com/' }),
  );

  beforeEach(() => {
    jest.clearAllMocks();
    findUniqueOrThrow.mockResolvedValue(BOLETO);
    update.mockResolvedValue({});
    send.mockResolvedValue();
  });

  it('manda o boleto com valor, vencimento, Pix, linha digitável e PDF', async () => {
    await service.enviar('boleto-id');

    const [[mensagem]] = send.mock.calls;
    expect(mensagem.to).toBe('farmacia01@example.com');
    expect(mensagem.subject).toBe(
      'Seu boleto de dezembro de 2026 - Elo Connect',
    );
    expect(mensagem.text).toContain('Valor: R$ 130,00');
    expect(mensagem.text).toContain('Vencimento: 10/12/2026');
    expect(mensagem.text).toContain(BOLETO.pixCopiaECola);
    expect(mensagem.text).toContain(BOLETO.linhaDigitavel);

    // O nome vem do cadastro: no HTML, ele é escapado.
    expect(mensagem.html).toContain('Olá, Farmácia &lt;Exemplo&gt; &amp; Cia.');
    expect(mensagem.html).toContain('<strong>Vencimento: 10/12/2026</strong>');
    expect(mensagem.html).toContain('<img src="cid:qr-code-pix"');
    expect(mensagem.html).toContain(BOLETO.pixCopiaECola);

    const [pdf, qrCode] = mensagem.attachments ?? [];
    expect(pdf).toMatchObject({
      filename: 'boleto-2026-12.pdf',
      contentType: 'application/pdf',
    });
    expect(pdf.content.toString('latin1')).toContain(
      `(${BOLETO.linhaDigitavel})`,
    );
    expect(qrCode).toMatchObject({
      filename: 'qr-code-pix.gif',
      contentType: 'image/gif',
      cid: 'qr-code-pix',
    });
    expect(qrCode.content.subarray(0, 6).toString('latin1')).toBe('GIF87a');

    expect(mensagem.text).toContain(
      'Você também encontra este boleto no site, em Meus boletos: https://app.example.com/associado/boletos',
    );
    expect(mensagem.html).toContain(
      '<a href="https://app.example.com/associado/boletos">Meus boletos</a>',
    );

    expect(update).toHaveBeenCalledWith({
      where: { id: 'boleto-id' },
      data: { emailEnviadoEm: expect.any(Date) },
    });
  });

  it('o lembrete antes do vencimento diz o dia do vencimento (RN07)', async () => {
    await service.enviar('boleto-id', 'LEMBRETE_ANTES');

    const [[mensagem]] = send.mock.calls;
    expect(mensagem.subject).toBe(
      'Seu boleto de dezembro de 2026 vence em 10/12/2026 - Elo Connect',
    );
    expect(mensagem.text).toContain(
      'Lembrete: o boleto de dezembro de 2026 da sua contribuição ao sindicato vence em 10/12/2026.',
    );
    expect(mensagem.text).toContain(BOLETO.pixCopiaECola);
    // O lembrete não muda a data do e-mail do boleto.
    expect(update).toHaveBeenCalledWith({
      where: { id: 'boleto-id' },
      data: { ultimoLembreteEm: expect.any(Date) },
    });
  });

  it('o lembrete depois do vencimento diz até quando dá para pagar (RN07, RN09)', async () => {
    await service.enviar('boleto-id', 'LEMBRETE_VENCIDO');

    const [[mensagem]] = send.mock.calls;
    expect(mensagem.subject).toBe(
      'Seu boleto de dezembro de 2026 está vencido - Elo Connect',
    );
    expect(mensagem.text).toContain(
      'venceu em 10/12/2026 e ainda não consta como pago.',
    );
    expect(mensagem.text).toContain('Você ainda pode pagar até 09/01/2027.');
    expect(mensagem.html).toContain(
      '<p>Se você já pagou, desconsidere este e-mail.</p>',
    );
  });

  it('sem nome fantasia, usa a razão social', async () => {
    findUniqueOrThrow.mockResolvedValue({
      ...BOLETO,
      associado: { ...BOLETO.associado, nomeFantasia: null },
    });

    await service.enviar('boleto-id');

    expect(send.mock.calls[0][0].text).toContain(
      'Olá, Farmácia Exemplo 01 Ltda.',
    );
  });

  it('se o envio falha, não marca o boleto, e o lote tenta de novo', async () => {
    send.mockRejectedValue(new Error('Limite diário do provedor.'));

    await expect(service.enviar('boleto-id')).rejects.toThrow(
      'Limite diário do provedor.',
    );
    expect(update).not.toHaveBeenCalled();
  });

  it.each([
    [
      'sem e-mail no cadastro',
      { associado: { ...BOLETO.associado, email: null } },
    ],
    ['ainda não emitido', { linhaDigitavel: null, pixCopiaECola: null }],
  ])('não manda o boleto %s', async (_caso, mudanca) => {
    findUniqueOrThrow.mockResolvedValue({
      ...BOLETO,
      ...mudanca,
    });

    await expect(service.enviar('boleto-id')).rejects.toThrow(
      'O boleto boleto-id não tem como ir por e-mail.',
    );
    expect(send).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});
