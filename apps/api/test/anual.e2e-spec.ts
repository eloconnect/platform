// Plano anual à vista pedido pelo associado (US17: RF17, RN13, P04). Roda no
// banco de teste (preparar-banco.mjs), com o mês de verdade.
import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { DIAS_VENCIMENTO_ADESAO } from '../src/cobranca/adesao.service.js';
import { somarMeses, ultimoDiaDaCobertura } from '../src/cobranca/cobertura.js';
import { PagamentosService } from '../src/cobranca/pagamentos.service.js';
import {
  competenciaDaData,
  dataDaCompetencia,
  hojeEmMatoGrosso,
  textoDia,
  valorAnualDoMes,
} from '../src/cobranca/valor-do-mes.js';
import { EmailService, type EmailMessage } from '../src/email/email.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

process.env.JWT_SECRET ??= 'segredo-so-para-teste-com-mais-de-32-caracteres';

/** E-mails "enviados" pela API, no lugar do SMTP. */
const enviados: EmailMessage[] = [];
const send = (mensagem: EmailMessage) => {
  enviados.push(mensagem);
  return Promise.resolve();
};

describe('Plano anual (e2e)', () => {
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
  const hoje = () => hojeEmMatoGrosso(new Date());
  const competencia = () => dataDaCompetencia(competenciaDaData(hoje()));

  /** Associado sem contribuição ativa, com conta e token. */
  async function criarAssociado(dados: object = {}) {
    const marcador = crypto.randomUUID();
    const associado = await prisma.associado.create({
      data: {
        cnpj: marcador.replace(/\D/g, '').padEnd(14, '0').slice(0, 14),
        razaoSocial: 'Farmácia do Plano Anual Ltda',
        email: `anual-${marcador}@example.com`,
        ...dados,
      },
    });
    criados.push(associado.id);
    const usuario = await prisma.usuario.create({
      data: {
        email: `anual-conta-${marcador}@example.com`,
        nome: 'Responsável',
        perfil: 'ASSOCIADO',
        senhaHash: 'x',
        associadoId: associado.id,
      },
    });
    return {
      associado,
      usuario,
      token: await assinar('ASSOCIADO', usuario.id),
    };
  }

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EmailService)
      .useValue({ send })
      .compile();
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
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
    // Sem nenhum valor, não há boleto. Outro teste pode ter
    // cadastrado um valor hoje, que só vale no mês seguinte; o de 2000 vale
    // para este mês e nunca passa na frente de um valor mais novo.
    if (!(await valorAnualDoMes(prisma, competencia()))) {
      const admin = await prisma.usuario.create({
        data: {
          email: `anual-admin-${crypto.randomUUID()}@example.com`,
          nome: 'Admin do Plano Anual',
          perfil: 'ADMIN',
          senhaHash: 'x',
        },
      });
      await prisma.valorContribuicao.create({
        data: {
          valorMensal: '120.00',
          valorAnual: '1152.00',
          alteradoPorId: admin.id,
          criadoEm: new Date('2000-01-01T12:00:00Z'),
        },
      });
    }
  });

  afterAll(async () => {
    // Os associados deste teste não entram nos lotes dos outros testes.
    await prisma.associado.updateMany({
      where: { id: { in: criados } },
      data: { contribuicaoAtiva: false },
    });
    await app.close();
  });

  const UM_DIA = 24 * 60 * 60 * 1000;
  const comToken = (token: string) => ({ Authorization: `Bearer ${token}` });

  it('recusa sem token (401) e para a sede (403)', async () => {
    const admin = await assinar('ADMIN', crypto.randomUUID());
    const semToken = await http().get('/associado/anual');
    const daSede = await http().post('/associado/anual').set(comToken(admin));

    expect([semToken.status, daSede.status]).toEqual([401, 403]);
  });

  it('gera o boleto do ano e, pago, o plano vale por 12 meses', async () => {
    const { associado, token } = await criarAssociado();
    const valor = (await valorAnualDoMes(prisma, competencia()))!.toFixed(2);
    const ultimo = somarMeses(competencia(), 11);

    const antes = await http()
      .get('/associado/anual')
      .set(comToken(token))
      .expect(200);
    expect(antes.body).toMatchObject({
      motivo: null,
      valorAnual: valor,
      primeiroMes: competenciaDaData(competencia()),
      ultimoMes: competenciaDaData(ultimo),
      vencimento: textoDia(
        new Date(hoje().getTime() + DIAS_VENCIMENTO_ADESAO * UM_DIA),
      ),
      emDiaAte: textoDia(ultimoDiaDaCobertura(ultimo)),
      planoAte: null,
    });

    const { body } = await http()
      .post('/associado/anual')
      .set(comToken(token))
      .expect(201);
    const boleto = await prisma.boleto.findUniqueOrThrow({
      where: { id: (body as { boletoId: string }).boletoId },
    });
    expect(boleto).toMatchObject({
      tipo: 'ANUAL',
      competencia: competencia(),
      status: 'EM_ABERTO',
      emailEnviadoEm: null,
    });
    expect(boleto.valor.toFixed(2)).toBe(valor);
    await http().post('/associado/anual').set(comToken(token)).expect(409);

    await app.get(PagamentosService).confirmar({
      nossoNumero: boleto.sicrediNossoNumero!,
      formaPagamento: 'PIX',
      valorPago: boleto.valor,
      pagoEm: new Date(),
    });

    const depois = await http()
      .get('/associado/anual')
      .set(comToken(token))
      .expect(200);
    expect(depois.body).toMatchObject({
      motivo: 'PLANO_EM_VIGOR',
      planoAte: competenciaDaData(ultimo),
    });
    const conta = await http()
      .get('/minha-conta')
      .set(comToken(token))
      .expect(200);
    expect(conta.body).toMatchObject({
      situacao: 'Adimplente',
      planoAnualAte: competenciaDaData(ultimo),
    });
    // O plano já cobre este mês: não há avulso.
    const avulso = await http()
      .get('/associado/avulso')
      .set(comToken(token))
      .expect(200);
    expect(avulso.body).toMatchObject({ motivo: 'PLANO_ANUAL' });
    expect(associado.contribuicaoAtiva).toBe(false);
  });

  it('com o boleto deste mês já pago, o plano começa no mês seguinte', async () => {
    const { associado, token } = await criarAssociado({
      contribuicaoAtiva: true,
    });
    await prisma.boleto.create({
      data: {
        associadoId: associado.id,
        tipo: 'MENSAL',
        competencia: competencia(),
        valor: '120.00',
        vencimento: competencia(),
        status: 'PAGO',
      },
    });

    const { body } = await http()
      .get('/associado/anual')
      .set(comToken(token))
      .expect(200);

    expect(body).toMatchObject({
      motivo: null,
      primeiroMes: competenciaDaData(somarMeses(competencia(), 1)),
      ultimoMes: competenciaDaData(somarMeses(competencia(), 12)),
    });
  });
});
