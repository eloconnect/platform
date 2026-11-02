// Cobrança formal por e-mail a todos os associados, sem boleto, com o envio
// escalonado pelo limite diário (US29: RF29, RN19, RNF09). Roda no banco de
// teste (preparar-banco.mjs). Só este teste usa os comunicados, então ele
// limpa as duas tabelas antes de cada caso.
import 'dotenv/config';
import type { Comunicado, PainelComunicados } from '@eloconnect/shared';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { ComunicadosService } from '../src/comunicados/comunicados.service.js';
import { EmailService, type EmailMessage } from '../src/email/email.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

process.env.JWT_SECRET ??= 'segredo-so-para-teste-com-mais-de-32-caracteres';

/** E-mails "enviados" pela API, no lugar do SMTP. */
const enviados: EmailMessage[] = [];
/** Quando ligado, o próximo e-mail falha, como o provedor no limite. */
let falharUmaVez = false;
const send = (mensagem: EmailMessage) => {
  if (falharUmaVez) {
    falharUmaVez = false;
    return Promise.reject(new Error('Limite do provedor'));
  }
  enviados.push(mensagem);
  return Promise.resolve();
};

describe('Cobrança formal (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwt: JwtService;
  let comunicados: ComunicadosService;
  let admin: { id: string; nome: string };
  let tokenAdmin: string;
  /** Associados criados aqui, que saem do lote no fim. */
  const criados: string[] = [];

  const http = () => request(app.getHttpServer());
  const assinar = (perfil: string, sub: string) =>
    jwt.signAsync(
      { perfil },
      { secret: process.env.JWT_SECRET, subject: sub, expiresIn: 300 },
    );
  const criarComunicado = (dados: object, token = tokenAdmin) =>
    http()
      .post('/comunicados')
      .set('Authorization', `Bearer ${token}`)
      .send(dados);

  async function criarAssociado(dados: object = {}) {
    const marcador = crypto.randomUUID();
    const associado = await prisma.associado.create({
      data: {
        cnpj: marcador.replace(/\D/g, '').padEnd(14, '0').slice(0, 14),
        razaoSocial: 'Farmácia do Comunicado Ltda',
        email: `comunicado-${marcador}@example.com`,
        ...dados,
      },
    });
    criados.push(associado.id);
    return associado;
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
    comunicados = app.get(ComunicadosService);
    admin = await prisma.usuario.create({
      data: {
        email: `comunicado-admin-${crypto.randomUUID()}@example.com`,
        nome: 'Admin do Comunicado',
        perfil: 'ADMIN',
        senhaHash: 'x',
      },
    });
    tokenAdmin = await assinar('ADMIN', admin.id);
    // Sem nenhum valor, não há comunicado. O de 2000 nunca é o atual quando
    // outro teste já cadastrou um.
    if (!(await prisma.valorContribuicao.findFirst())) {
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

  beforeEach(async () => {
    await prisma.envioComunicado.deleteMany();
    await prisma.comunicado.deleteMany();
    enviados.length = 0;
    delete process.env.LIMITE_DIARIO_COMUNICADO;
  });

  afterAll(async () => {
    await prisma.associado.updateMany({
      where: { id: { in: criados } },
      data: { contribuicaoAtiva: false },
    });
    await prisma.envioComunicado.deleteMany();
    await prisma.comunicado.deleteMany();
    await app.close();
  });

  it('só o chave mestre vê e envia a cobrança formal (RN33)', async () => {
    const basico = await assinar('ADMIN_BASICO', crypto.randomUUID());
    const associado = await assinar('ASSOCIADO', crypto.randomUUID());

    const respostas = await Promise.all([
      http().get('/comunicados'),
      http().get('/comunicados').set('Authorization', `Bearer ${basico}`),
      criarComunicado({ assunto: 'A', texto: 'B' }, basico),
      criarComunicado({ assunto: 'A', texto: 'B' }, associado),
    ]);

    expect(respostas.map((r) => r.status)).toEqual([401, 403, 403, 403]);
  });

  it('pede o assunto e o texto', async () => {
    const resposta = await criarComunicado({ assunto: '  ', texto: '' });

    expect(resposta.status).toBe(400);
    expect(resposta.body.message).toEqual(
      expect.arrayContaining([
        'Escreva o assunto.',
        'Escreva o texto do comunicado.',
      ]),
    );
  });

  it('vai para todos do cadastro com e-mail, pagando ou não, menos os inativados', async () => {
    const pagante = await criarAssociado({ contribuicaoAtiva: true });
    const naoPagante = await criarAssociado();
    const inativado = await criarAssociado({ inativadoEm: new Date() });
    const semEmail = await criarAssociado({ email: null });

    const { body } = await criarComunicado({
      assunto: ' Cobrança formal ',
      texto: 'Texto da sede.',
    }).expect(201);

    const comunicado = body as Comunicado;
    expect(comunicado).toMatchObject({
      assunto: 'Cobrança formal',
      criadoPor: { nome: 'Admin do Comunicado' },
      enviados: 0,
      concluidoEm: null,
    });
    expect(comunicado.mensagem).toMatch(
      /^Texto da sede\.\n\nValor da contribuição: R\$/,
    );
    // O valor exato fica no teste da mensagem: o teste de valores roda ao
    // mesmo tempo e pode cadastrar outro valor no meio deste.
    expect(comunicado.mensagem).toMatch(
      /Valor da contribuição: R\$\s[\d.]+,\d{2} por mês\./,
    );
    const destinos = (
      await prisma.envioComunicado.findMany({
        where: { comunicadoId: comunicado.id },
        select: { associadoId: true },
      })
    ).map(({ associadoId }) => associadoId);
    expect(destinos).toHaveLength(comunicado.total);
    expect(destinos).toEqual(
      expect.arrayContaining([pagante.id, naoPagante.id]),
    );
    expect(destinos).not.toContain(inativado.id);
    expect(destinos).not.toContain(semEmail.id);
    const log = await prisma.logAuditoria.findFirstOrThrow({
      where: { entidadeId: comunicado.id },
    });
    expect(log).toMatchObject({
      usuarioId: admin.id,
      acao: 'COMUNICADO_CRIADO',
      valorNovo: {
        assunto: 'Cobrança formal',
        destinatarios: comunicado.total,
      },
    });
    // Nada sai na hora: o job diário manda aos poucos.
    expect(enviados).toHaveLength(0);
    const painel = await http()
      .get('/comunicados')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);
    expect(painel.body as PainelComunicados).toMatchObject({
      limiteDiario: 150,
      comunicados: [{ id: comunicado.id, enviados: 0, concluidoEm: null }],
    });
  });

  it('um comunicado por vez, mesmo com dois pedidos juntos', async () => {
    await criarAssociado();

    const respostas = await Promise.all([
      criarComunicado({ assunto: 'Um', texto: 'Texto.' }),
      criarComunicado({ assunto: 'Dois', texto: 'Texto.' }),
    ]);

    expect(respostas.map((r) => r.status).toSorted((a, b) => a - b)).toEqual([
      201, 409,
    ]);
    expect(await prisma.comunicado.count()).toBe(1);
  });

  it('o job manda até o limite de cada dia e continua no dia seguinte', async () => {
    await criarAssociado();
    process.env.LIMITE_DIARIO_COMUNICADO = '3';
    const { body } = await criarComunicado({
      assunto: 'Cobrança formal',
      texto: 'Texto da sede.',
    }).expect(201);
    const { id, total } = body as Comunicado;
    // 10 de janeiro de 2000, 7h40 em Mato Grosso, e mais tarde no mesmo dia.
    const dia10 = new Date('2000-01-10T11:40:00Z');

    await expect(comunicados.enviarDoDia(dia10)).resolves.toEqual({
      dia: '2000-01-10',
      enviados: 3,
      pendentes: total - 3,
    });
    expect(enviados).toHaveLength(3);
    expect(enviados[0]).toMatchObject({ subject: 'Cobrança formal' });
    expect(enviados[0].text).toMatch(/^Olá, .+\.\n\nTexto da sede\./);
    // O limite é do dia: rodar de novo não manda mais nada.
    await expect(
      comunicados.enviarDoDia(new Date('2000-01-10T20:00:00Z')),
    ).resolves.toMatchObject({ enviados: 0 });

    // No dia seguinte, o provedor recusa o primeiro e-mail: o job para, e
    // ele sai no outro dia.
    falharUmaVez = true;
    await expect(
      comunicados.enviarDoDia(new Date('2000-01-11T11:40:00Z')),
    ).resolves.toMatchObject({ enviados: 0, pendentes: total - 3 });

    process.env.LIMITE_DIARIO_COMUNICADO = String(total);
    await expect(
      comunicados.enviarDoDia(new Date('2000-01-12T11:40:00Z')),
    ).resolves.toEqual({
      dia: '2000-01-12',
      enviados: total - 3,
      pendentes: 0,
    });
    // Um e-mail para cada envio. Associados diferentes podem ter o mesmo
    // endereço, como uma rede de farmácias.
    expect(enviados).toHaveLength(total);
    const painel = await comunicados.painel();
    expect(painel.comunicados[0]).toMatchObject({
      id,
      enviados: total,
      concluidoEm: '2000-01-12T11:40:00.000Z',
    });
    // Terminado o envio, a sede pode mandar outro comunicado.
    await criarComunicado({ assunto: 'Outro', texto: 'Texto.' }).expect(201);
  });
});
