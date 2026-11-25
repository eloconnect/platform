// Matriz e filiais (RF43, RN31, P14). Roda no banco de teste
// (preparar-banco.mjs).
import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { EmailService, type EmailMessage } from '../src/email/email.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

process.env.JWT_SECRET ??= 'segredo-so-para-teste-com-mais-de-32-caracteres';

/** E-mails "enviados" pela API, no lugar do SMTP. */
const enviados: EmailMessage[] = [];
const send = (mensagem: EmailMessage) => {
  enviados.push(mensagem);
  return Promise.resolve();
};

describe('Matriz e filiais (e2e)', () => {
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

  /** Associado sem contribuição ativa, com conta e token. */
  async function criarAssociado(dados: object = {}) {
    const marcador = crypto.randomUUID();
    const associado = await prisma.associado.create({
      data: {
        cnpj: marcador.replace(/\D/g, '').padEnd(14, '0').slice(0, 14),
        razaoSocial: 'Farmácia da Rede Ltda',
        email: `filiais-${marcador}@example.com`,
        ...dados,
      },
    });
    criados.push(associado.id);
    const usuario = await prisma.usuario.create({
      data: {
        email: `filiais-conta-${marcador}@example.com`,
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
          email: `filiais-admin-${crypto.randomUUID()}@example.com`,
          nome: 'Admin das Filiais',
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

  /** Raiz de CNPJ nova a cada teste: 8 dígitos. */
  const raizNova = () =>
    crypto.randomUUID().replace(/\D/g, '').padEnd(8, '7').slice(0, 8);

  it('a matriz vê as filiais da mesma raiz e baixa o PDF do boleto delas', async () => {
    const raiz = raizNova();
    const matriz = await criarAssociado({ cnpj: `${raiz}000191` });
    const filial = await criarAssociado({
      cnpj: `${raiz}000272`,
      situacao: 'INADIMPLENTE',
      contribuicaoAtiva: true,
    });
    const outraRede = await criarAssociado({ cnpj: `${raizNova()}000272` });
    const boleto = await prisma.boleto.create({
      data: {
        associadoId: filial.associado.id,
        tipo: 'MENSAL',
        competencia: new Date('2099-06-01'),
        valor: '120.00',
        vencimento: new Date('2099-06-10'),
        status: 'EM_ABERTO',
        sicrediNossoNumero: crypto.randomUUID(),
        linhaDigitavel: '00000.00000 00000.000000 00000.000000 0 0',
        pixCopiaECola: '00020126-pix-ficticio',
      },
    });

    const { body } = await http()
      .get('/associado/filiais')
      .set(comToken(matriz.token))
      .expect(200);
    expect(body).toEqual([
      expect.objectContaining({
        id: filial.associado.id,
        situacao: 'Inadimplente',
        boletos: [expect.objectContaining({ id: boleto.id })],
      }),
    ]);

    const pdf = await http()
      .get(`/associado/filiais/${filial.associado.id}/boletos/${boleto.id}/pdf`)
      .set(comToken(matriz.token))
      .buffer(true)
      .expect(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');

    // A filial não vê a matriz, e outra rede não baixa o boleto.
    const daFilial = await http()
      .get('/associado/filiais')
      .set(comToken(filial.token))
      .expect(200);
    expect(daFilial.body).toEqual([]);
    await http()
      .get(`/associado/filiais/${filial.associado.id}/boletos/${boleto.id}/pdf`)
      .set(comToken(outraRede.token))
      .expect(404);
  });
});
