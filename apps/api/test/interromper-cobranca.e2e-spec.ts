// Interrupção da cobrança recorrente pela sede (US35: RF38, RN25). Roda no
// banco de teste (preparar-banco.mjs).
import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { hojeEmMatoGrosso, textoDia } from '../src/cobranca/valor-do-mes.js';
import { EmailService, type EmailMessage } from '../src/email/email.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

process.env.JWT_SECRET ??= 'segredo-so-para-teste-com-mais-de-32-caracteres';

const caminho = (id: string) => `/associados/${id}/interromper-cobranca`;

/** E-mails "enviados" pela API, no lugar do SMTP. */
const enviados: EmailMessage[] = [];
const send = (mensagem: EmailMessage) => {
  enviados.push(mensagem);
  return Promise.resolve();
};

describe('Interromper a cobrança recorrente (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwt: JwtService;
  let tokenAdmin: string;
  let adminId: string;

  const http = () => request(app.getHttpServer());
  const assinar = (perfil: string, sub: string) =>
    jwt.signAsync(
      { perfil },
      { secret: process.env.JWT_SECRET, subject: sub, expiresIn: 300 },
    );

  function criarAssociado() {
    const marcador = crypto.randomUUID();
    return prisma.associado.create({
      data: {
        cnpj: marcador.replace(/\D/g, '').padEnd(14, '0').slice(0, 14),
        razaoSocial: 'Farmácia da Interrupção Ltda',
        email: `interromper-${marcador}@example.com`,
        situacao: 'ADIMPLENTE',
        contribuicaoAtiva: true,
      },
    });
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
    const admin = await prisma.usuario.create({
      data: {
        email: `interromper-admin-${crypto.randomUUID()}@example.com`,
        nome: 'Admin da Interrupção',
        perfil: 'ADMIN',
        senhaHash: 'x',
      },
    });
    adminId = admin.id;
    tokenAdmin = await assinar('ADMIN', admin.id);
  });

  afterAll(() => app.close());

  it('recusa sem token (401) e para o perfil básico (403)', async () => {
    const { id } = await criarAssociado();
    const semToken = await http().post(caminho(id)).send({ motivo: 'Teste' });
    const basico = await http()
      .post(caminho(id))
      .set(
        'Authorization',
        `Bearer ${await assinar('ADMIN_BASICO', crypto.randomUUID())}`,
      )
      .send({ motivo: 'Teste' });

    expect([semToken.status, basico.status]).toEqual([401, 403]);
  });

  it('o chave mestre interrompe: sem boleto mensal, com aviso e 30 dias de acesso', async () => {
    const associado = await criarAssociado();

    const resposta = await http()
      .post(caminho(associado.id))
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ motivo: '  A farmácia pediu para pagar só no fim do ano.  ' })
      .expect(200);

    const hoje = hojeEmMatoGrosso(new Date());
    const acessoAte = textoDia(
      new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000),
    );
    expect(resposta.body).toMatchObject({
      contribuicaoAtiva: false,
      situacao: 'ADIMPLENTE',
      proximoBoleto: null,
      interrupcaoCobranca: { acessoAte },
    });

    const [log] = await prisma.logAuditoria.findMany({
      where: { associadoId: associado.id, usuarioId: adminId },
    });
    expect(log).toMatchObject({
      acao: 'CONTRIBUICAO_INTERROMPIDA',
      valorAnterior: { contribuicaoAtiva: true },
      valorNovo: {
        contribuicaoAtiva: false,
        motivo: 'A farmácia pediu para pagar só no fim do ano.',
      },
    });

    const [aviso] = enviados.filter(({ to }) => to === associado.email);
    expect(aviso.subject).toBe(
      'A cobrança mensal foi interrompida - Elo Connect',
    );
    const [ano, mes, dia] = acessoAte.split('-');
    expect(aviso.text).toContain(
      `O seu acesso a benefícios e suporte continua até ${dia}/${mes}/${ano}.`,
    );
    // O motivo fica só no log.
    expect(aviso.text).not.toContain('fim do ano');

    // De novo: já não recebe o boleto mensal.
    await http()
      .post(caminho(associado.id))
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ motivo: 'De novo' })
      .expect(400);
  });

  it('exige o motivo', async () => {
    const { id } = await criarAssociado();

    await http()
      .post(caminho(id))
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ motivo: '   ' })
      .expect(400);
  });

  it('a edição do cadastro não interrompe; ativar de novo desfaz a interrupção', async () => {
    const associado = await criarAssociado();
    const editar = (dados: object) =>
      http()
        .patch(`/associados/${associado.id}`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send(dados);

    const recusada = await editar({ contribuicaoAtiva: false }).expect(400);
    expect(recusada.body).toMatchObject({ campo: 'contribuicaoAtiva' });

    await http()
      .post(caminho(associado.id))
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ motivo: 'Teste' })
      .expect(200);
    await editar({ contribuicaoAtiva: true }).expect(200);

    const { body } = await http()
      .get(`/associados/${associado.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);
    expect(body).toMatchObject({
      contribuicaoAtiva: true,
      interrupcaoCobranca: null,
    });
  });
});
