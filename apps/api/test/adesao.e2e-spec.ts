// Adesão à cobrança recorrente pelo associado (US33: RF36, RN23). Roda no banco
// de teste (preparar-banco.mjs), com o mês de verdade: o boleto da adesão é
// sempre o deste mês.
import 'dotenv/config';
import { TERMO_ADESAO, textoCompetencia } from '@eloconnect/shared';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { DIAS_VENCIMENTO_ADESAO } from '../src/cobranca/adesao.service.js';
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

describe('Adesão à cobrança recorrente (e2e)', () => {
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
        razaoSocial: 'Farmácia da Adesão Ltda',
        email: `adesao-${marcador}@example.com`,
        ...dados,
      },
    });
    criados.push(associado.id);
    const usuario = await prisma.usuario.create({
      data: {
        email: `adesao-conta-${marcador}@example.com`,
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
    // Sem nenhum valor, não há adesão. O valor de 2000 nunca é o atual
    // quando outro teste já cadastrou um.
    if (!(await prisma.valorContribuicao.findFirst())) {
      const admin = await prisma.usuario.create({
        data: {
          email: `adesao-admin-${crypto.randomUUID()}@example.com`,
          nome: 'Admin da Adesão',
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

  it('recusa sem token (401) e para a sede (403)', async () => {
    const admin = await assinar('ADMIN', crypto.randomUUID());
    const semToken = await http().get('/associado/adesao');
    const daSede = await http()
      .post('/associado/adesao')
      .set('Authorization', `Bearer ${admin}`)
      .send({ versaoTermo: TERMO_ADESAO.versao });

    expect([semToken.status, daSede.status]).toEqual([401, 403]);
  });

  it('adere: liga a contribuição, guarda o aceite e emite o boleto do mês', async () => {
    const { associado, usuario, token } = await criarAssociado({
      // Interrompida antes pela sede: aderir de novo desfaz (RN25).
      cobrancaInterrompidaEm: new Date('2026-01-01T12:00:00Z'),
    });
    const valor = (await valorDoMes(prisma, competencia()))!.toFixed(2);

    const antes = await http()
      .get('/associado/adesao')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(antes.body).toEqual({
      recebeBoletoMensal: false,
      valorMensal: valor,
    });

    const versaoErrada = await http()
      .post('/associado/adesao')
      .set('Authorization', `Bearer ${token}`)
      .send({ versaoTermo: 'versao-antiga' })
      .expect(400);
    expect(versaoErrada.body).toMatchObject({ campo: 'versaoTermo' });

    const resposta = await http()
      .post('/associado/adesao')
      .set('Authorization', `Bearer ${token}`)
      .send({ versaoTermo: TERMO_ADESAO.versao })
      .expect(201);
    expect(resposta.body).toEqual({ boletoGerado: true });

    expect(
      await prisma.associado.findUniqueOrThrow({
        where: { id: associado.id },
        select: { contribuicaoAtiva: true, cobrancaInterrompidaEm: true },
      }),
    ).toEqual({ contribuicaoAtiva: true, cobrancaInterrompidaEm: null });
    const [aceite] = await prisma.adesaoCobranca.findMany({
      where: { associadoId: associado.id },
    });
    expect(aceite).toMatchObject({
      usuarioId: usuario.id,
      versaoTermo: TERMO_ADESAO.versao,
    });
    expect(aceite.aceitaEm).toBeInstanceOf(Date);

    const [boleto] = await prisma.boleto.findMany({
      where: { associadoId: associado.id },
      include: { transacoes: { orderBy: { evento: 'asc' } } },
    });
    expect(boleto).toMatchObject({
      tipo: 'MENSAL',
      competencia: competencia(),
      status: 'EM_ABERTO',
      loteId: null,
    });
    expect(boleto.valor.toFixed(2)).toBe(valor);
    // TODO(P16): vencimento provisório.
    expect(textoDia(boleto.vencimento)).toBe(
      textoDia(
        new Date(
          hoje().getTime() + DIAS_VENCIMENTO_ADESAO * 24 * 60 * 60 * 1000,
        ),
      ),
    );
    expect(boleto.emailEnviadoEm).toBeInstanceOf(Date);
    expect(boleto.transacoes.map(({ evento }) => evento)).toEqual([
      'GERADO',
      'EMITIDO',
    ]);
    const [email] = enviados.filter(({ to }) => to === associado.email);
    expect(email.subject).toBe(
      `Seu boleto de ${textoCompetencia(competenciaDaData(hoje()))} - Elo Connect`,
    );

    // De novo: já recebe.
    await http()
      .post('/associado/adesao')
      .set('Authorization', `Bearer ${token}`)
      .send({ versaoTermo: TERMO_ADESAO.versao })
      .expect(409);
    const depois = await http()
      .get('/associado/adesao')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(depois.body).toMatchObject({ recebeBoletoMensal: true });
  });

  it('quem já tem o boleto deste mês adere sem receber outro', async () => {
    const { associado, token } = await criarAssociado();
    await prisma.boleto.create({
      data: {
        associadoId: associado.id,
        tipo: 'MENSAL',
        competencia: competencia(),
        valor: '120.00',
        vencimento: new Date(competencia().getTime() + 9 * 24 * 60 * 60 * 1000),
        status: 'PAGO',
      },
    });

    const resposta = await http()
      .post('/associado/adesao')
      .set('Authorization', `Bearer ${token}`)
      .send({ versaoTermo: TERMO_ADESAO.versao })
      .expect(201);

    expect(resposta.body).toEqual({ boletoGerado: false });
    expect(
      await prisma.boleto.count({ where: { associadoId: associado.id } }),
    ).toBe(1);
  });

  it('o cadastro inativado não adere', async () => {
    const { token } = await criarAssociado({ inativadoEm: new Date() });

    await http()
      .post('/associado/adesao')
      .set('Authorization', `Bearer ${token}`)
      .send({ versaoTermo: TERMO_ADESAO.versao })
      .expect(400);
  });

  it('o aceite do termo não pode ser alterado nem apagado', async () => {
    const { associado, token } = await criarAssociado();
    await http()
      .post('/associado/adesao')
      .set('Authorization', `Bearer ${token}`)
      .send({ versaoTermo: TERMO_ADESAO.versao })
      .expect(201);
    const [aceite] = await prisma.adesaoCobranca.findMany({
      where: { associadoId: associado.id },
    });

    await expect(
      prisma.adesaoCobranca.update({
        where: { id: aceite.id },
        data: { versaoTermo: 'outra' },
      }),
    ).rejects.toThrow('imutável');
    await expect(
      prisma.adesaoCobranca.delete({ where: { id: aceite.id } }),
    ).rejects.toThrow('imutável');
  });
});
