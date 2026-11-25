// Boleto avulso pedido pelo associado (US34: RF37, RN24, P10). Roda no banco de
// teste (preparar-banco.mjs), com o mês de verdade: o avulso é sempre o deste
// mês.
import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { DIAS_VENCIMENTO_ADESAO } from '../src/cobranca/adesao.service.js';
import { ultimoDiaDaCobertura } from '../src/cobranca/cobertura.js';
import {
  competenciaDaData,
  dataDaCompetencia,
  hojeEmMatoGrosso,
  textoDia,
  valorDoMes,
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

describe('Boleto avulso (e2e)', () => {
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
        razaoSocial: 'Farmácia do Avulso Ltda',
        email: `avulso-${marcador}@example.com`,
        ...dados,
      },
    });
    criados.push(associado.id);
    const usuario = await prisma.usuario.create({
      data: {
        email: `avulso-conta-${marcador}@example.com`,
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
    // Sem nenhum valor, não há boleto. O valor de 2000 nunca é o atual
    // quando outro teste já cadastrou um.
    if (!(await prisma.valorContribuicao.findFirst())) {
      const admin = await prisma.usuario.create({
        data: {
          email: `avulso-admin-${crypto.randomUUID()}@example.com`,
          nome: 'Admin do Avulso',
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
    const semToken = await http().get('/associado/avulso');
    const daSede = await http().post('/associado/avulso').set(comToken(admin));

    expect([semToken.status, daSede.status]).toEqual([401, 403]);
  });

  it('gera o boleto deste mês na hora, sem e-mail, e não gera outro', async () => {
    const { associado, token } = await criarAssociado();
    const valor = (await valorDoMes(prisma, competencia()))!.toFixed(2);
    const vencimento = textoDia(
      new Date(hoje().getTime() + DIAS_VENCIMENTO_ADESAO * UM_DIA),
    );

    const antes = await http()
      .get('/associado/avulso')
      .set(comToken(token))
      .expect(200);
    expect(antes.body).toEqual({
      motivo: null,
      valor,
      vencimento,
      emDiaAte: textoDia(ultimoDiaDaCobertura(competencia())),
    });

    const resposta = await http()
      .post('/associado/avulso')
      .set(comToken(token))
      .expect(201);

    const [boleto] = await prisma.boleto.findMany({
      where: { associadoId: associado.id },
      include: { transacoes: { orderBy: { evento: 'asc' } } },
    });
    expect(resposta.body).toEqual({ boletoId: boleto.id });
    expect(boleto).toMatchObject({
      tipo: 'AVULSO',
      competencia: competencia(),
      status: 'EM_ABERTO',
      loteId: null,
      emailEnviadoEm: null,
    });
    expect(boleto.valor.toFixed(2)).toBe(valor);
    expect(textoDia(boleto.vencimento)).toBe(vencimento);
    expect(boleto.linhaDigitavel).toBeTruthy();
    expect(boleto.transacoes.map(({ evento }) => evento)).toEqual([
      'GERADO',
      'EMITIDO',
    ]);
    // Não vai por e-mail: fica em "Meus boletos".
    expect(enviados.filter(({ to }) => to === associado.email)).toEqual([]);
    const meus = await http()
      .get('/associado/boletos')
      .set(comToken(token))
      .expect(200);
    expect(meus.body).toEqual([expect.objectContaining({ id: boleto.id })]);
    // A farmácia não passa a receber o boleto todo mês.
    expect(
      (
        await prisma.associado.findUniqueOrThrow({
          where: { id: associado.id },
        })
      ).contribuicaoAtiva,
    ).toBe(false);

    // De novo: o boleto do mês continua para pagar.
    await http().post('/associado/avulso').set(comToken(token)).expect(409);
    const depois = await http()
      .get('/associado/avulso')
      .set(comToken(token))
      .expect(200);
    expect(depois.body).toMatchObject({ motivo: 'BOLETO_EM_ABERTO' });
  });

  it('dois pedidos juntos geram um boleto só', async () => {
    const { associado, token } = await criarAssociado();

    const respostas = await Promise.all([
      http().post('/associado/avulso').set(comToken(token)),
      http().post('/associado/avulso').set(comToken(token)),
    ]);

    expect(respostas.map(({ status }) => status)).toEqual(
      expect.arrayContaining([201, 409]),
    );
    expect(
      await prisma.boleto.count({ where: { associadoId: associado.id } }),
    ).toBe(1);
  });

  it.each([
    ['RECEBE_BOLETO_MENSAL', { contribuicaoAtiva: true }, null, 409],
    ['BOLETO_EXPIRADO', {}, 'EXPIRADO', 409],
    ['MES_JA_PAGO', {}, 'PAGO', 409],
    ['INATIVO', { inativadoEm: new Date() }, null, 400],
  ] as const)(
    'não gera quando o motivo é %s',
    async (motivo, dados, statusBoleto, codigo) => {
      const { associado, token } = await criarAssociado(dados);
      if (statusBoleto) {
        await prisma.boleto.create({
          data: {
            associadoId: associado.id,
            tipo: 'MENSAL',
            // O expirado é de um mês antigo; o pago é deste mês.
            competencia:
              statusBoleto === 'PAGO' ? competencia() : new Date('2000-01-01'),
            valor: '120.00',
            vencimento: new Date('2000-01-10'),
            status: statusBoleto,
          },
        });
      }

      const situacao = await http()
        .get('/associado/avulso')
        .set(comToken(token))
        .expect(200);
      expect(situacao.body).toMatchObject({ motivo });
      await http()
        .post('/associado/avulso')
        .set(comToken(token))
        .expect(codigo);
    },
  );
});
