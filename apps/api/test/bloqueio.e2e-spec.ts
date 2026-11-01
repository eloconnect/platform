// Bloqueio automático quando o boleto expira (US16: RF16, RN03, RN09). Roda no
// banco de teste (preparar-banco.mjs). O histórico dos boletos não pode ser
// apagado, então cada teste roda numa transação desfeita no fim.
import 'dotenv/config';
import { jest } from '@jest/globals';
import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { BloqueioService } from '../src/cobranca/bloqueio.service.js';
import { TransacoesService } from '../src/cobranca/transacoes.service.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';

process.env.JWT_SECRET ??= 'segredo-so-para-teste-com-mais-de-32-caracteres';

type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

class Desfazer extends Error {}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

/**
 * Roda o teste numa transação desfeita no fim. O serviço usa essa mesma
 * transação no lugar do banco, inclusive nas transações dele.
 */
async function desfazendoNoFim(
  teste: (tx: Tx, bloqueio: BloqueioService) => Promise<void>,
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
        await teste(tx, new BloqueioService(banco, new TransacoesService()));
        throw new Desfazer();
      },
      { timeout: 60_000 },
    )
    .catch((erro: unknown) => {
      if (!(erro instanceof Desfazer)) throw erro;
    });
}

function criarAssociado(
  tx: Tx,
  dados: {
    situacao: 'ADIMPLENTE' | 'INADIMPLENTE';
    acessoManual?: 'LIBERADO';
  },
) {
  return tx.associado.create({
    data: {
      cnpj: crypto.randomUUID().replace(/\D/g, '').padEnd(14, '0').slice(0, 14),
      razaoSocial: 'Farmácia do Bloqueio Ltda',
      contribuicaoAtiva: true,
      ...dados,
    },
  });
}

/** Boleto de maio de 2099: vence em 10/05 e vale até 09/06. */
function criarBoleto(
  tx: Tx,
  associadoId: string,
  status: 'EM_ABERTO' | 'PAGO' = 'EM_ABERTO',
) {
  return tx.boleto.create({
    data: {
      associadoId,
      tipo: 'MENSAL',
      competencia: new Date('2099-05-01'),
      valor: '120.00',
      vencimento: new Date('2099-05-10'),
      status,
    },
  });
}

describe('Bloqueio automático (e2e)', () => {
  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterAll(() => prisma.$disconnect());

  it('até o último dia para pagar, no horário de Mato Grosso, nada muda', async () => {
    await desfazendoNoFim(async (tx, bloqueio) => {
      const associado = await criarAssociado(tx, { situacao: 'ADIMPLENTE' });
      const boleto = await criarBoleto(tx, associado.id);

      // 9 de junho de 2099, 23h30 em Mato Grosso: o último dia para pagar.
      await expect(
        bloqueio.executar(new Date('2099-06-10T03:30:00Z')),
      ).resolves.toMatchObject({ dia: '2099-06-09' });

      expect(
        (await tx.boleto.findUniqueOrThrow({ where: { id: boleto.id } }))
          .status,
      ).toBe('EM_ABERTO');
      expect(
        (await tx.associado.findUniqueOrThrow({ where: { id: associado.id } }))
          .situacao,
      ).toBe('ADIMPLENTE');
    });
  });

  it('no dia seguinte, o boleto expira e o associado fica bloqueado', async () => {
    await desfazendoNoFim(async (tx, bloqueio) => {
      const associado = await criarAssociado(tx, { situacao: 'ADIMPLENTE' });
      const boleto = await criarBoleto(tx, associado.id);
      // Pago no prazo: não muda.
      const pagou = await criarAssociado(tx, { situacao: 'ADIMPLENTE' });
      const pago = await criarBoleto(tx, pagou.id, 'PAGO');
      // Liberado pela sede (RN11): o boleto expira, a liberação continua.
      const liberado = await criarAssociado(tx, {
        situacao: 'ADIMPLENTE',
        acessoManual: 'LIBERADO',
      });
      await criarBoleto(tx, liberado.id);
      // Já estava em atraso: o boleto expira, e ele continua inadimplente.
      const emAtraso = await criarAssociado(tx, { situacao: 'INADIMPLENTE' });
      await criarBoleto(tx, emAtraso.id);

      // 10 de junho de 2099, 0h30 em Mato Grosso.
      const resultado = await bloqueio.executar(
        new Date('2099-06-10T04:30:00Z'),
      );

      expect(resultado.dia).toBe('2099-06-10');
      // O banco de teste guarda boletos de outros testes, então as contagens
      // são no mínimo as deste teste.
      expect(resultado.expirados).toBeGreaterThanOrEqual(3);
      expect(resultado.bloqueados).toBeGreaterThanOrEqual(2);
      const expirado = await tx.boleto.findUniqueOrThrow({
        where: { id: boleto.id },
        include: { transacoes: { orderBy: { ocorridoEm: 'asc' } } },
      });
      expect(expirado.status).toBe('EXPIRADO');
      // Feito pelo sistema, sem ninguém da sede.
      expect(
        expirado.transacoes.map(({ evento, usuarioId }) => [evento, usuarioId]),
      ).toEqual([['EXPIRADO', null]]);

      const situacao = async (id: string) =>
        tx.associado.findUniqueOrThrow({
          where: { id },
          select: { situacao: true, acessoManual: true },
        });
      expect(await situacao(associado.id)).toEqual({
        situacao: 'INADIMPLENTE',
        acessoManual: null,
      });
      expect(await situacao(pagou.id)).toEqual({
        situacao: 'ADIMPLENTE',
        acessoManual: null,
      });
      expect(await situacao(liberado.id)).toEqual({
        situacao: 'INADIMPLENTE',
        acessoManual: 'LIBERADO',
      });
      expect(await situacao(emAtraso.id)).toEqual({
        situacao: 'INADIMPLENTE',
        acessoManual: null,
      });
      expect(
        (await tx.boleto.findUniqueOrThrow({ where: { id: pago.id } })).status,
      ).toBe('PAGO');

      // Rodar de novo não muda nada.
      await expect(
        bloqueio.executar(new Date('2099-06-10T12:00:00Z')),
      ).resolves.toEqual({
        dia: '2099-06-10',
        expirados: 0,
        bloqueados: 0,
        fimDoAcesso: 0,
      });
    });
  });

  it('quem estava em dia perde o acesso 30 dias depois da interrupção da cobrança (RN25)', async () => {
    await desfazendoNoFim(async (tx, bloqueio) => {
      // Interrompida em 1º de maio de 2099, 15h em Mato Grosso: o acesso
      // vale até 31 de maio.
      const interrompido = await tx.associado.create({
        data: {
          cnpj: crypto
            .randomUUID()
            .replace(/\D/g, '')
            .padEnd(14, '0')
            .slice(0, 14),
          razaoSocial: 'Farmácia Interrompida Ltda',
          situacao: 'ADIMPLENTE',
          contribuicaoAtiva: false,
          cobrancaInterrompidaEm: new Date('2099-05-01T19:00:00Z'),
        },
      });
      const situacao = async () =>
        (
          await tx.associado.findUniqueOrThrow({
            where: { id: interrompido.id },
          })
        ).situacao;

      // 31 de maio, 23h30 em Mato Grosso: ainda tem acesso.
      await bloqueio.executar(new Date('2099-06-01T03:30:00Z'));
      expect(await situacao()).toBe('ADIMPLENTE');

      // 1º de junho, 0h30 em Mato Grosso: perde o acesso.
      const resultado = await bloqueio.executar(
        new Date('2099-06-01T04:30:00Z'),
      );
      expect(resultado.fimDoAcesso).toBeGreaterThanOrEqual(1);
      expect(await situacao()).toBe('INADIMPLENTE');
    });
  });
});

describe('Rota do bloqueio automático (e2e)', () => {
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
      '/tarefas/bloqueio',
    );
    const outroSegredo = await request(app.getHttpServer())
      .get('/tarefas/bloqueio')
      .set('Authorization', 'Bearer outro-segredo');
    expect([semSegredo.status, outroSegredo.status]).toEqual([401, 401]);
  });
});
