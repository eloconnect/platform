// Baixa automática do pagamento e desbloqueio (US15: RF15, RN10). Roda no
// banco de teste (preparar-banco.mjs). Os testes do serviço rodam numa
// transação desfeita no fim; os da rota, com boletos de 2099.
import 'dotenv/config';
import type { ResultadoPagamento } from '@eloconnect/shared';
import {
  ConflictException,
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { AuditoriaService } from '../src/auditoria/auditoria.service.js';
import { GatewaySimulado } from '../src/cobranca/gateway-simulado.js';
import { PagamentosService } from '../src/cobranca/pagamentos.service.js';
import { TransacoesService } from '../src/cobranca/transacoes.service.js';
import { Prisma, PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

process.env.JWT_SECRET ??= 'segredo-so-para-teste-com-mais-de-32-caracteres';

type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];
type Banco = Tx | PrismaService;

class Desfazer extends Error {}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

/**
 * Roda o teste numa transação desfeita no fim. O serviço usa essa mesma
 * transação no lugar do banco, inclusive nas transações dele.
 */
async function desfazendoNoFim(
  teste: (tx: Tx, pagamentos: PagamentosService) => Promise<void>,
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
          new PagamentosService(
            banco,
            new TransacoesService(),
            new AuditoriaService(),
            new GatewaySimulado(),
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

function criarAssociado(banco: Banco, situacao: 'ADIMPLENTE' | 'INADIMPLENTE') {
  return banco.associado.create({
    data: {
      cnpj: crypto.randomUUID().replace(/\D/g, '').padEnd(14, '0').slice(0, 14),
      razaoSocial: 'Farmácia do Pagamento Ltda',
      situacao,
    },
  });
}

function criarBoleto(
  banco: Banco,
  associadoId: string,
  mes: number,
  status: 'EM_ABERTO' | 'EXPIRADO' | 'CANCELADO' = 'EM_ABERTO',
) {
  const doisDigitos = String(mes).padStart(2, '0');
  return banco.boleto.create({
    data: {
      associadoId,
      tipo: 'MENSAL',
      competencia: new Date(`2099-${doisDigitos}-01`),
      valor: '120.00',
      vencimento: new Date(`2099-${doisDigitos}-10`),
      status,
      sicrediNossoNumero: `PAG${crypto.randomUUID().replace(/\D/g, '').slice(0, 12)}`,
      linhaDigitavel: '74891.00000 00000.000000 00000.000000 0 00000000012000',
      pixCopiaECola: '00020101-pix-simulado',
    },
  });
}

const PAGO_EM = new Date('2099-06-08T15:00:00Z');

const caminho = (id: string) => `/boletos/${id}/pagamento-simulado`;

describe('Baixa do pagamento (e2e)', () => {
  afterAll(() => prisma.$disconnect());

  it('marca o boleto como pago, registra no histórico e desbloqueia o associado', async () => {
    await desfazendoNoFim(async (tx, pagamentos) => {
      const associado = await criarAssociado(tx, 'INADIMPLENTE');
      const boleto = await criarBoleto(tx, associado.id, 6, 'EXPIRADO');
      const pagamento = {
        nossoNumero: boleto.sicrediNossoNumero!,
        formaPagamento: 'PIX' as const,
        valorPago: new Prisma.Decimal('120.00'),
        pagoEm: PAGO_EM,
      };

      await expect(pagamentos.confirmar(pagamento)).resolves.toEqual({
        boletoId: boleto.id,
        jaEstavaPago: false,
        desbloqueado: true,
      } satisfies ResultadoPagamento);

      const pago = await tx.boleto.findUniqueOrThrow({
        where: { id: boleto.id },
        include: { transacoes: true },
      });
      expect(pago).toMatchObject({ status: 'PAGO', pagoEm: PAGO_EM });
      // Feito pelo sistema, sem ninguém da sede.
      expect(pago.transacoes).toEqual([
        expect.objectContaining({
          evento: 'PAGO',
          formaPagamento: 'PIX',
          usuarioId: null,
          detalhes: null,
        }),
      ]);
      expect(
        (await tx.associado.findUniqueOrThrow({ where: { id: associado.id } }))
          .situacao,
      ).toBe('ADIMPLENTE');

      // O banco pode avisar o mesmo pagamento duas vezes.
      await expect(pagamentos.confirmar(pagamento)).resolves.toEqual({
        boletoId: boleto.id,
        jaEstavaPago: true,
        desbloqueado: false,
      });
      expect(await tx.transacao.count({ where: { boletoId: boleto.id } })).toBe(
        1,
      );
    });
  });

  it('com outro boleto expirado, o associado continua bloqueado (RN30)', async () => {
    await desfazendoNoFim(async (tx, pagamentos) => {
      const associado = await criarAssociado(tx, 'INADIMPLENTE');
      const maio = await criarBoleto(tx, associado.id, 5, 'EXPIRADO');
      const junho = await criarBoleto(tx, associado.id, 6);
      const pagar = (nossoNumero: string) =>
        pagamentos.confirmar({
          nossoNumero,
          formaPagamento: 'BOLETO',
          valorPago: new Prisma.Decimal('120.00'),
          pagoEm: PAGO_EM,
        });

      await expect(pagar(junho.sicrediNossoNumero!)).resolves.toMatchObject({
        desbloqueado: false,
      });
      await expect(pagar(maio.sicrediNossoNumero!)).resolves.toMatchObject({
        desbloqueado: true,
      });
    });
  });

  it('guarda o valor pago quando ele é diferente do valor do boleto', async () => {
    await desfazendoNoFim(async (tx, pagamentos) => {
      const associado = await criarAssociado(tx, 'ADIMPLENTE');
      const boleto = await criarBoleto(tx, associado.id, 6);

      await pagamentos.confirmar({
        nossoNumero: boleto.sicrediNossoNumero!,
        formaPagamento: 'BOLETO',
        valorPago: new Prisma.Decimal('100.00'),
        pagoEm: PAGO_EM,
      });

      const [transacao] = await tx.transacao.findMany({
        where: { boletoId: boleto.id },
      });
      expect(transacao.detalhes).toEqual({ valorPago: '100.00' });
    });
  });

  it('recusa boleto desconhecido ou cancelado', async () => {
    await desfazendoNoFim(async (tx, pagamentos) => {
      const associado = await criarAssociado(tx, 'ADIMPLENTE');
      const cancelado = await criarBoleto(tx, associado.id, 6, 'CANCELADO');
      const pagar = (nossoNumero: string) =>
        pagamentos.confirmar({
          nossoNumero,
          formaPagamento: 'PIX',
          valorPago: new Prisma.Decimal('120.00'),
          pagoEm: PAGO_EM,
        });

      await expect(pagar('NAO-EXISTE')).rejects.toThrow(NotFoundException);
      await expect(pagar(cancelado.sicrediNossoNumero!)).rejects.toThrow(
        ConflictException,
      );
    });
  });
});

describe('Pagamento simulado pela sede (e2e)', () => {
  let app: INestApplication<App>;
  let banco: PrismaService;
  let jwt: JwtService;

  const http = () => request(app.getHttpServer());
  const assinar = (perfil: string, sub: string) =>
    jwt.signAsync(
      { perfil },
      { secret: process.env.JWT_SECRET, subject: sub, expiresIn: 300 },
    );

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = modulo.createNestApplication();
    // Mesma validação do main.ts.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    banco = app.get(PrismaService);
    jwt = app.get(JwtService);
  });

  afterAll(() => app.close());

  it('só o chave mestre simula (401 e 403)', async () => {
    const associado = await criarAssociado(banco, 'ADIMPLENTE');
    const boleto = await criarBoleto(banco, associado.id, 9);
    const respostas = [
      await http().post(caminho(boleto.id)).send({ formaPagamento: 'PIX' }),
    ];
    for (const perfil of ['ADMIN_BASICO', 'ASSOCIADO']) {
      respostas.push(
        await http()
          .post(caminho(boleto.id))
          .set(
            'Authorization',
            `Bearer ${await assinar(perfil, crypto.randomUUID())}`,
          )
          .send({ formaPagamento: 'PIX' }),
      );
    }

    expect(respostas.map(({ status }) => status)).toEqual([401, 403, 403]);
    expect(
      (await banco.boleto.findUniqueOrThrow({ where: { id: boleto.id } }))
        .status,
    ).toBe('EM_ABERTO');
  });

  it('o chave mestre simula o pagamento, que fica no histórico e no log', async () => {
    const admin = await banco.usuario.create({
      data: {
        email: `pagamento-${crypto.randomUUID()}@example.com`,
        nome: 'Admin do Pagamento',
        perfil: 'ADMIN',
        senhaHash: 'x',
      },
    });
    const token = await assinar('ADMIN', admin.id);
    const associado = await criarAssociado(banco, 'INADIMPLENTE');
    const boleto = await criarBoleto(banco, associado.id, 9);
    const simular = (id: string, corpo: object) =>
      http()
        .post(caminho(id))
        .set('Authorization', `Bearer ${token}`)
        .send(corpo);

    const resposta = await simular(boleto.id, { formaPagamento: 'BOLETO' });
    expect([resposta.status, resposta.body]).toEqual([
      200,
      { boletoId: boleto.id, jaEstavaPago: false, desbloqueado: true },
    ]);
    const [transacao] = await banco.transacao.findMany({
      where: { boletoId: boleto.id },
    });
    expect(transacao).toMatchObject({
      evento: 'PAGO',
      formaPagamento: 'BOLETO',
      usuarioId: admin.id,
    });
    const [log] = await banco.logAuditoria.findMany({
      where: { usuarioId: admin.id },
    });
    expect(log).toMatchObject({
      acao: 'PAGAMENTO_SIMULADO',
      entidadeId: boleto.id,
      associadoId: associado.id,
      valorNovo: {
        competencia: '2099-09',
        valor: '120.00',
        formaPagamento: 'BOLETO',
      },
    });

    // De novo: nada muda, nem no log.
    const repetido = await simular(boleto.id, { formaPagamento: 'BOLETO' });
    expect(repetido.body).toMatchObject({ jaEstavaPago: true });
    expect(
      await banco.logAuditoria.count({ where: { usuarioId: admin.id } }),
    ).toBe(1);

    const invalida = await simular(boleto.id, { formaPagamento: 'CARTAO' });
    const inexistente = await simular(crypto.randomUUID(), {
      formaPagamento: 'PIX',
    });
    expect([invalida.status, inexistente.status]).toEqual([400, 404]);
  });
});
