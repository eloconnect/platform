// Boleto único dos meses em aberto (US34: RF37, RN30). Roda no banco de teste
// (preparar-banco.mjs), com o mês de verdade: o boleto sai neste mês.
import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { DIAS_VENCIMENTO_ADESAO } from '../src/cobranca/adesao.service.js';
import { PagamentosService } from '../src/cobranca/pagamentos.service.js';
import {
  competenciaDaData,
  dataDaCompetencia,
  hojeEmMatoGrosso,
  textoDia,
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

describe('Boleto dos meses em aberto (e2e)', () => {
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
        razaoSocial: 'Farmácia dos Meses Ltda',
        email: `quitacao-${marcador}@example.com`,
        ...dados,
      },
    });
    criados.push(associado.id);
    const usuario = await prisma.usuario.create({
      data: {
        email: `quitacao-conta-${marcador}@example.com`,
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
          email: `quitacao-admin-${crypto.randomUUID()}@example.com`,
          nome: 'Admin da Quitação',
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

  /** Espera até a condição valer, por até 2 segundos. */
  async function esperar(condicao: () => boolean) {
    for (let i = 0; i < 40 && !condicao(); i++) {
      await new Promise((fim) => setTimeout(fim, 50));
    }
    expect(condicao()).toBe(true);
  }
  const comToken = (token: string) => ({ Authorization: `Bearer ${token}` });

  /** Chave mestre de verdade: a decisão grava quem decidiu. */
  async function chaveMestre() {
    const usuario = await prisma.usuario.create({
      data: {
        email: `quitacao-sede-${crypto.randomUUID()}@example.com`,
        nome: 'Chave Mestre',
        perfil: 'ADMIN',
        senhaHash: 'x',
      },
    });
    return { usuario, token: await assinar('ADMIN', usuario.id) };
  }

  /** Dois meses expirados, de 120 e 130 reais. */
  async function comMesesExpirados() {
    const dados = await criarAssociado({ situacao: 'INADIMPLENTE' });
    for (const [mes, valor] of [
      ['2000-01-01', '120.00'],
      ['2000-02-01', '130.00'],
    ]) {
      await prisma.boleto.create({
        data: {
          associadoId: dados.associado.id,
          tipo: 'MENSAL',
          competencia: new Date(mes),
          valor,
          vencimento: new Date(mes),
          status: 'EXPIRADO',
          sicrediNossoNumero: crypto.randomUUID(),
        },
      });
    }
    return dados;
  }

  it('recusa sem token (401), a sede no pedido e o associado na decisão (403)', async () => {
    const admin = await assinar('ADMIN', crypto.randomUUID());
    const { token } = await criarAssociado();
    const semToken = await http().get('/associado/meses-em-aberto');
    const daSede = await http()
      .post('/associado/meses-em-aberto')
      .set(comToken(admin));
    const doAssociado = await http()
      .get('/pedidos-quitacao')
      .set(comToken(token));
    const doBasico = await http()
      .get('/pedidos-quitacao')
      .set(comToken(await assinar('ADMIN_BASICO', crypto.randomUUID())));

    expect([
      semToken.status,
      daSede.status,
      doAssociado.status,
      doBasico.status,
    ]).toEqual([401, 403, 403, 403]);
  });

  it('pede, a sede aprova, o boleto sai e, pago, a farmácia volta a ficar em dia', async () => {
    const { associado, token } = await comMesesExpirados();
    const sede = await chaveMestre();

    const antes = await http()
      .get('/associado/meses-em-aberto')
      .set(comToken(token))
      .expect(200);
    expect(antes.body).toEqual({
      meses: [
        { competencia: { ano: 2000, mes: 1 }, valor: '120.00' },
        { competencia: { ano: 2000, mes: 2 }, valor: '130.00' },
      ],
      total: '250.00',
      pedido: null,
      boletoEmAberto: false,
    });

    const pedido = await http()
      .post('/associado/meses-em-aberto')
      .set(comToken(token))
      .expect(201);
    expect(pedido.body).toMatchObject({ pedido: { status: 'PENDENTE' } });
    // A sede recebe o aviso por e-mail, que sai depois da resposta.
    await esperar(() => enviados.some(({ to }) => to === sede.usuario.email));
    // De novo: o pedido já foi enviado.
    await http()
      .post('/associado/meses-em-aberto')
      .set(comToken(token))
      .expect(409);

    const pendentes = await http()
      .get(`/pedidos-quitacao?associadoId=${associado.id}`)
      .set(comToken(sede.token))
      .expect(200);
    expect(pendentes.body).toEqual([
      expect.objectContaining({ associadoId: associado.id, total: '250.00' }),
    ]);
    const pedidoId = (pendentes.body as { id: string }[])[0].id;

    const decisao = await http()
      .post(`/pedidos-quitacao/${pedidoId}/decisao`)
      .set(comToken(sede.token))
      .send({ decisao: 'APROVADO', observacao: 'Combinado por telefone' })
      .expect(200);
    const boletoId = (decisao.body as { boletoId: string }).boletoId;

    const boleto = await prisma.boleto.findUniqueOrThrow({
      where: { id: boletoId },
      include: { quita: true },
    });
    expect(boleto).toMatchObject({
      tipo: 'QUITACAO',
      competencia: competencia(),
      status: 'EM_ABERTO',
    });
    expect(boleto.valor.toFixed(2)).toBe('250.00');
    expect(textoDia(boleto.vencimento)).toBe(
      textoDia(new Date(hoje().getTime() + DIAS_VENCIMENTO_ADESAO * UM_DIA)),
    );
    expect(boleto.quita).toHaveLength(2);
    expect(boleto.emailEnviadoEm).toBeInstanceOf(Date);
    const [log] = await prisma.logAuditoria.findMany({
      where: { entidadeId: pedidoId },
    });
    expect(log).toMatchObject({
      acao: 'QUITACAO_APROVADA',
      usuarioId: sede.usuario.id,
      valorNovo: {
        status: 'APROVADO',
        valor: '250.00',
        meses: '2000-01, 2000-02',
        observacao: 'Combinado por telefone',
      },
    });
    // Decidir de novo não muda nada.
    await http()
      .post(`/pedidos-quitacao/${pedidoId}/decisao`)
      .set(comToken(sede.token))
      .send({ decisao: 'RECUSADO' })
      .expect(409);

    const depois = await http()
      .get('/associado/meses-em-aberto')
      .set(comToken(token))
      .expect(200);
    expect(depois.body).toMatchObject({ boletoEmAberto: true });

    // Pago, os meses que ele junta contam como pagos (RN10, RN30).
    const resultado = await app.get(PagamentosService).confirmar({
      nossoNumero: boleto.sicrediNossoNumero!,
      formaPagamento: 'PIX',
      valorPago: boleto.valor,
      pagoEm: new Date(),
    });
    expect(resultado.desbloqueado).toBe(true);
    const historico = await http()
      .get('/associado/boletos/historico')
      .set(comToken(token))
      .expect(200);
    expect(
      (historico.body as { tipo: string; pagoJunto: boolean }[])
        .filter(({ tipo }) => tipo === 'MENSAL')
        .map(({ pagoJunto }) => pagoJunto),
    ).toEqual([true, true]);
    const fim = await http()
      .get('/associado/meses-em-aberto')
      .set(comToken(token))
      .expect(200);
    expect(fim.body).toMatchObject({ meses: [], boletoEmAberto: false });
  });

  it('a sede recusa: nenhum boleto sai, e o associado pode pedir de novo', async () => {
    const { associado, token } = await comMesesExpirados();
    const sede = await chaveMestre();
    await http()
      .post('/associado/meses-em-aberto')
      .set(comToken(token))
      .expect(201);
    const [{ id }] = await prisma.pedidoQuitacao.findMany({
      where: { associadoId: associado.id },
    });

    await http()
      .post(`/pedidos-quitacao/${id}/decisao`)
      .set(comToken(sede.token))
      .send({ decisao: 'RECUSADO' })
      .expect(200);

    expect(
      await prisma.boleto.count({
        where: { associadoId: associado.id, tipo: 'QUITACAO' },
      }),
    ).toBe(0);
    const situacao = await http()
      .get('/associado/meses-em-aberto')
      .set(comToken(token))
      .expect(200);
    expect(situacao.body).toMatchObject({ pedido: { status: 'RECUSADO' } });
    await http()
      .post('/associado/meses-em-aberto')
      .set(comToken(token))
      .expect(201);
  });

  it('sem meses expirados, não há pedido', async () => {
    const { token } = await criarAssociado();

    await http()
      .post('/associado/meses-em-aberto')
      .set(comToken(token))
      .expect(409);
  });
});
