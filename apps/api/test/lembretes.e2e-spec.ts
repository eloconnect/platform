// Lembretes antes e depois do vencimento (US13, US14: RF13, RF14, RN07). Roda
// no banco de teste (preparar-banco.mjs), numa transação desfeita no fim.
import 'dotenv/config';
import { jest } from '@jest/globals';
import { INestApplication, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { EmailBoletoService } from '../src/cobranca/email-boleto.service.js';
import { GatewaySimulado } from '../src/cobranca/gateway-simulado.js';
import { LembretesService } from '../src/cobranca/lembretes.service.js';
import type { EmailMessage, EmailService } from '../src/email/email.service.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';

process.env.JWT_SECRET ??= 'segredo-so-para-teste-com-mais-de-32-caracteres';

type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

class Desfazer extends Error {}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

/** E-mails "enviados", no lugar do SMTP. */
const enviados: EmailMessage[] = [];
const send = (mensagem: EmailMessage) => {
  enviados.push(mensagem);
  return Promise.resolve();
};
const enviadosPara = (endereco: string) =>
  enviados.filter(({ to }) => to === endereco);

async function desfazendoNoFim(
  teste: (tx: Tx, lembretes: LembretesService) => Promise<void>,
) {
  await prisma
    .$transaction(
      async (tx) => {
        const banco = new Proxy(tx, {
          get: (alvo, nome) =>
            nome === '$transaction'
              ? (fn: (t: Tx) => unknown) => fn(alvo)
              : Reflect.get(alvo, nome),
        }) as unknown as PrismaService;
        await teste(
          tx,
          new LembretesService(
            banco,
            new EmailBoletoService(
              banco,
              new GatewaySimulado(),
              { send } as unknown as EmailService,
              new ConfigService(),
            ),
          ),
        );
        throw new Desfazer();
      },
      { timeout: 60_000 },
    )
    .catch((erro: unknown) => {
      if (!(erro instanceof Desfazer)) throw erro;
    });
}

/** Associado com e-mail e um boleto de junho de 2099, que vence em 10/06. */
async function criarAssociadoComBoleto(
  tx: Tx,
  email: string,
  dados: { contribuicaoAtiva: boolean; status?: 'EM_ABERTO' | 'PAGO' },
) {
  const associado = await tx.associado.create({
    data: {
      cnpj: crypto.randomUUID().replace(/\D/g, '').padEnd(14, '0').slice(0, 14),
      razaoSocial: 'Farmácia do Lembrete Ltda',
      email,
      contribuicaoAtiva: dados.contribuicaoAtiva,
    },
  });
  const nossoNumero = `LEM${crypto.randomUUID().replace(/\D/g, '').slice(0, 12)}`;
  return tx.boleto.create({
    data: {
      associadoId: associado.id,
      tipo: 'MENSAL',
      competencia: new Date('2099-06-01'),
      valor: '120.00',
      vencimento: new Date('2099-06-10'),
      status: dados.status ?? 'EM_ABERTO',
      sicrediNossoNumero: nossoNumero,
      linhaDigitavel: '74891.00000 00000.000000 00000.000000 0 00000000012000',
      pixCopiaECola: `00020101-pix-simulado-${nossoNumero}`,
    },
  });
}

describe('Lembretes (e2e)', () => {
  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  beforeEach(() => {
    enviados.length = 0;
  });

  afterAll(() => prisma.$disconnect());

  it('manda o lembrete 48h antes e um por semana depois do vencimento', async () => {
    await desfazendoNoFim(async (tx, lembretes) => {
      const boleto = await criarAssociadoComBoleto(
        tx,
        'lembrete-ativo@example.com',
        { contribuicaoAtiva: true },
      );
      // Sem contribuição ativa ou com o boleto pago: sem lembrete.
      await criarAssociadoComBoleto(
        tx,
        'lembrete-sem-contribuicao@example.com',
        {
          contribuicaoAtiva: false,
        },
      );
      await criarAssociadoComBoleto(tx, 'lembrete-pago@example.com', {
        contribuicaoAtiva: true,
        status: 'PAGO',
      });

      // 8 de junho, 7h20 em Mato Grosso: 48h antes do vencimento.
      await expect(
        lembretes.executar(new Date('2099-06-08T11:20:00Z')),
      ).resolves.toMatchObject({ dia: '2099-06-08', falhas: 0 });
      const [antes] = enviadosPara('lembrete-ativo@example.com');
      expect(antes.subject).toBe(
        'Seu boleto de junho de 2099 vence em 10/06/2099 - Elo Connect',
      );
      expect(antes.attachments?.map(({ filename }) => filename)).toEqual([
        'boleto-2099-06.pdf',
        'qr-code-pix.gif',
      ]);
      const depoisDoPrimeiro = await tx.boleto.findUniqueOrThrow({
        where: { id: boleto.id },
      });
      expect(depoisDoPrimeiro.ultimoLembreteEm).toBeInstanceOf(Date);
      // O lembrete não entra no histórico de transações.
      expect(await tx.transacao.count({ where: { boletoId: boleto.id } })).toBe(
        0,
      );

      // Na véspera, já recebeu: nada de novo.
      await lembretes.executar(new Date('2099-06-09T11:20:00Z'));
      expect(enviadosPara('lembrete-ativo@example.com')).toHaveLength(1);

      // Uma semana depois do vencimento.
      await lembretes.executar(new Date('2099-06-17T11:20:00Z'));
      const [, vencido] = enviadosPara('lembrete-ativo@example.com');
      expect(vencido.subject).toBe(
        'Seu boleto de junho de 2099 está vencido - Elo Connect',
      );
      expect(vencido.text).toContain('Você ainda pode pagar até 10/07/2099.');

      expect(enviadosPara('lembrete-sem-contribuicao@example.com')).toEqual([]);
      expect(enviadosPara('lembrete-pago@example.com')).toEqual([]);
    });
  });
});

describe('Rota dos lembretes (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = modulo.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  it('só responde ao cron, que manda o CRON_SECRET', async () => {
    const semSegredo = await request(app.getHttpServer()).get(
      '/tarefas/lembretes',
    );
    const outroSegredo = await request(app.getHttpServer())
      .get('/tarefas/lembretes')
      .set('Authorization', 'Bearer outro-segredo');
    expect([semSegredo.status, outroSegredo.status]).toEqual([401, 401]);
  });
});
