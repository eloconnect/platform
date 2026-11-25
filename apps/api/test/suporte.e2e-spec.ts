// Benefícios e suporte do associado (US25: RF25, RN32, P06, P15). Roda no banco
// de teste (preparar-banco.mjs).
import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import {
  competenciaDaData,
  dataDaCompetencia,
  hojeEmMatoGrosso,
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

describe('Benefícios e suporte (e2e)', () => {
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
        razaoSocial: 'Farmácia do Suporte Ltda',
        email: `suporte-${marcador}@example.com`,
        ...dados,
      },
    });
    criados.push(associado.id);
    const usuario = await prisma.usuario.create({
      data: {
        email: `suporte-conta-${marcador}@example.com`,
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
          email: `suporte-admin-${crypto.randomUUID()}@example.com`,
          nome: 'Admin do Suporte',
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

  const comToken = (token: string) => ({ Authorization: `Bearer ${token}` });

  /** Espera até a condição valer, por até 2 segundos. */
  async function esperar(condicao: () => boolean) {
    for (let i = 0; i < 40 && !condicao(); i++) {
      await new Promise((fim) => setTimeout(fim, 50));
    }
    expect(condicao()).toBe(true);
  }

  it('em dia, a consultoria vale; a assessoria jurídica pede o plano anual (RN32)', async () => {
    const emDia = await criarAssociado({ situacao: 'ADIMPLENTE' });
    const comPlano = await criarAssociado({ situacao: 'ADIMPLENTE' });
    await prisma.boleto.create({
      data: {
        associadoId: comPlano.associado.id,
        tipo: 'ANUAL',
        competencia: competencia(),
        valor: '1152.00',
        vencimento: competencia(),
        status: 'PAGO',
      },
    });
    const atrasado = await criarAssociado({ situacao: 'INADIMPLENTE' });
    const liberado = await criarAssociado({
      situacao: 'INADIMPLENTE',
      acessoManual: 'LIBERADO',
      acessoManualAte: new Date(Date.now() + 86_400_000),
    });

    const ver = async (token: string) =>
      (
        await http()
          .get('/associado/beneficios')
          .set(comToken(token))
          .expect(200)
      ).body as { consultoriaLiberada: boolean; juridicaLiberada: boolean };

    expect(await ver(emDia.token)).toMatchObject({
      consultoriaLiberada: true,
      juridicaLiberada: false,
    });
    expect(await ver(comPlano.token)).toMatchObject({
      consultoriaLiberada: true,
      juridicaLiberada: true,
    });
    expect(await ver(atrasado.token)).toMatchObject({
      consultoriaLiberada: false,
      juridicaLiberada: false,
    });
    expect(await ver(liberado.token)).toMatchObject({
      consultoriaLiberada: true,
      juridicaLiberada: true,
    });
  });

  it('em dia, pede suporte; a sede recebe, marca como respondido e fica no log', async () => {
    const { associado, token } = await criarAssociado({
      situacao: 'ADIMPLENTE',
    });
    const sede = await prisma.usuario.create({
      data: {
        email: `suporte-sede-${crypto.randomUUID()}@example.com`,
        nome: 'Atendente',
        perfil: 'ADMIN_BASICO',
        senhaHash: 'x',
      },
    });
    const tokenSede = await assinar('ADMIN_BASICO', sede.id);

    await http()
      .post('/associado/suporte')
      .set(comToken(token))
      .send({ assunto: ' ', mensagem: 'Texto' })
      .expect(400);
    await http()
      .post('/associado/suporte')
      .set(comToken(token))
      .send({ assunto: 'Dúvida sobre férias', mensagem: 'Como calcular?' })
      .expect(201);
    await esperar(() =>
      enviados.some(
        (m) => m.to === sede.email && m.replyTo === associado.email,
      ),
    );

    const lista = await http()
      .get('/suporte')
      .set(comToken(tokenSede))
      .expect(200);
    const pedido = (
      lista.body as { id: string; associado: { id: string } }[]
    ).find((p) => p.associado.id === associado.id)!;
    expect(pedido).toMatchObject({
      assunto: 'Dúvida sobre férias',
      respondidoEm: null,
    });

    const marcado = await http()
      .post(`/suporte/${pedido.id}/respondido`)
      .set(comToken(tokenSede))
      .expect(200);
    expect(marcado.body).toMatchObject({ respondidoPor: 'Atendente' });
    await http()
      .post(`/suporte/${pedido.id}/respondido`)
      .set(comToken(tokenSede))
      .expect(409);
    const [log] = await prisma.logAuditoria.findMany({
      where: { entidadeId: pedido.id },
    });
    expect(log).toMatchObject({
      acao: 'SUPORTE_RESPONDIDO',
      usuarioId: sede.id,
    });
  });

  it('quem não está em dia não pede suporte (403), e o associado não vê a lista', async () => {
    const { token } = await criarAssociado({ situacao: 'INADIMPLENTE' });

    await http()
      .post('/associado/suporte')
      .set(comToken(token))
      .send({ assunto: 'Ajuda', mensagem: 'Texto' })
      .expect(403);
    await http().get('/suporte').set(comToken(token)).expect(403);
  });
});
