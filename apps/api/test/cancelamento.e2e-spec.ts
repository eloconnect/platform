// Pedido de cancelamento do boleto mensal pelo associado (US26: RF26, RN18).
// Roda no banco de teste (preparar-banco.mjs).
import 'dotenv/config';
import type { AssociadoDetalhe } from '@eloconnect/shared';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

process.env.JWT_SECRET ??= 'segredo-so-para-teste-com-mais-de-32-caracteres';

describe('Pedido de cancelamento (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwt: JwtService;
  /** Associados criados aqui, que saem do lote no fim. */
  const criados: string[] = [];

  const http = () => request(app.getHttpServer());
  const assinar = (perfil: string, sub: string) =>
    jwt.signAsync(
      { perfil },
      { secret: process.env.JWT_SECRET, subject: sub, expiresIn: 300 },
    );

  /** Associado com conta e token; por padrão, recebe o boleto mensal. */
  async function criarAssociado(contribuicaoAtiva = true) {
    const marcador = crypto.randomUUID();
    const associado = await prisma.associado.create({
      data: {
        cnpj: marcador.replace(/\D/g, '').padEnd(14, '0').slice(0, 14),
        razaoSocial: 'Farmácia do Cancelamento Ltda',
        email: `cancelamento-${marcador}@example.com`,
        situacao: 'ADIMPLENTE',
        contribuicaoAtiva,
      },
    });
    criados.push(associado.id);
    const usuario = await prisma.usuario.create({
      data: {
        email: `cancelamento-conta-${marcador}@example.com`,
        nome: 'Responsável',
        perfil: 'ASSOCIADO',
        senhaHash: 'x',
        associadoId: associado.id,
      },
    });
    const token = await assinar('ASSOCIADO', usuario.id);
    return {
      associado,
      pedir: () =>
        http()
          .post('/associado/cancelamento')
          .set('Authorization', `Bearer ${token}`),
      minhaConta: () =>
        http().get('/minha-conta').set('Authorization', `Bearer ${token}`),
    };
  }

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = modulo.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
  });

  afterAll(async () => {
    // Os associados deste teste não entram nos lotes dos outros testes.
    await prisma.associado.updateMany({
      where: { id: { in: criados } },
      data: { contribuicaoAtiva: false },
    });
    await app.close();
  });

  it('recusa sem token (401) e para a sede (403)', async () => {
    const semToken = await http().post('/associado/cancelamento');
    const daSede = await http()
      .post('/associado/cancelamento')
      .set(
        'Authorization',
        `Bearer ${await assinar('ADMIN', crypto.randomUUID())}`,
      );

    expect([semToken.status, daSede.status]).toEqual([401, 403]);
  });

  it('o pedido fica pendente, e a sede vê o cancelamento solicitado', async () => {
    const { associado, pedir, minhaConta } = await criarAssociado();

    const { body } = await pedir().expect(201);

    const pedidoEm = (body as { pedidoEm: string }).pedidoEm;
    expect(new Date(pedidoEm).getTime()).toBeLessThanOrEqual(Date.now());
    expect((await minhaConta().expect(200)).body).toMatchObject({
      // Até a sede decidir, a farmácia continua recebendo o boleto.
      recebeBoletoMensal: true,
      cancelamentoPedidoEm: pedidoEm,
    });
    const perfil = await http()
      .get(`/associados/${associado.id}`)
      .set(
        'Authorization',
        `Bearer ${await assinar('ADMIN_BASICO', crypto.randomUUID())}`,
      )
      .expect(200);
    expect((perfil.body as AssociadoDetalhe).cancelamentos).toEqual([
      expect.objectContaining({
        status: 'PENDENTE',
        solicitadaEm: pedidoEm,
        decididaEm: null,
        decididaPor: null,
      }),
    ]);
  });

  it('não aceita um segundo pedido enquanto o primeiro espera a sede', async () => {
    const { associado, pedir } = await criarAssociado();
    await pedir().expect(201);

    const repetido = await pedir().expect(409);

    expect(repetido.body.message).toBe(
      'O pedido de cancelamento já foi enviado. A sede vai responder.',
    );
    expect(
      await prisma.solicitacaoCancelamento.count({
        where: { associadoId: associado.id },
      }),
    ).toBe(1);
  });

  it('dois pedidos ao mesmo tempo viram um só', async () => {
    const { associado, pedir } = await criarAssociado();

    const respostas = await Promise.all([pedir(), pedir()]);

    expect(respostas.map((r) => r.status).toSorted((a, b) => a - b)).toEqual([
      201, 409,
    ]);
    expect(
      await prisma.solicitacaoCancelamento.count({
        where: { associadoId: associado.id },
      }),
    ).toBe(1);
  });

  it('quem não recebe o boleto mensal não tem o que cancelar', async () => {
    const { associado, pedir, minhaConta } = await criarAssociado(false);

    const resposta = await pedir().expect(409);

    expect(resposta.body.message).toBe(
      'A farmácia não recebe o boleto mensal.',
    );
    expect((await minhaConta().expect(200)).body).toMatchObject({
      recebeBoletoMensal: false,
      cancelamentoPedidoEm: null,
    });
    expect(
      await prisma.solicitacaoCancelamento.count({
        where: { associadoId: associado.id },
      }),
    ).toBe(0);
  });
});
