// Painel de valores (US18 a US20: RF18 a RF20) e aviso por e-mail da mudança
// de valor (US19: RF19, RN15). Só o chave mestre usa (RN20, RN33). Roda no
// banco de teste (preparar-banco.mjs); o histórico não pode ser apagado, então
// cada teste usa um valor novo.
import 'dotenv/config';
import {
  cnpjValido,
  competenciaDoNovoValor,
  formatarReais,
  textoCompetencia,
  type PainelValores,
} from '@eloconnect/shared';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { EmailService, type EmailMessage } from '../src/email/email.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

process.env.JWT_SECRET ??= 'segredo-so-para-teste-com-mais-de-32-caracteres';

/** CNPJ numérico válido e diferente a cada chamada. */
function cnpjNovo(): string {
  const base = String(Math.floor(Math.random() * 1e12)).padStart(12, '0');
  for (let dv = 0; dv < 100; dv++) {
    const cnpj = base + String(dv).padStart(2, '0');
    if (cnpjValido(cnpj)) return cnpj;
  }
  throw new Error('Não achei os dígitos verificadores.');
}

/** Valor mensal novo a cada chamada, entre 100,00 e 999,99. */
function valorNovo(): string {
  return (100 + Math.floor(Math.random() * 90_000) / 100).toFixed(2);
}

describe('Valores (e2e)', () => {
  // E-mails "enviados" pela API, no lugar do SMTP.
  const enviados: EmailMessage[] = [];
  const send = (mensagem: EmailMessage) => {
    enviados.push(mensagem);
    return Promise.resolve();
  };
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tokenAdmin: string;
  let adminId: string;
  let jwt: JwtService;

  const http = () => request(app.getHttpServer());
  const assinar = (perfil: string, sub: string) =>
    jwt.signAsync(
      { perfil },
      { secret: process.env.JWT_SECRET, subject: sub, expiresIn: 300 },
    );

  async function alterar(valorMensal: string) {
    const resposta = await http()
      .post('/valores')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ valorMensal })
      .expect(201);
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return resposta.body as PainelValores;
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
        email: `valores-${crypto.randomUUID()}@example.com`,
        nome: 'Admin dos Valores',
        perfil: 'ADMIN',
        senhaHash: 'x',
      },
    });
    adminId = admin.id;
    tokenAdmin = await assinar('ADMIN', admin.id);
  });

  afterAll(() => app.close());

  it('recusa sem token (401) e para o perfil básico e o associado (403)', async () => {
    const basico = await assinar('ADMIN_BASICO', crypto.randomUUID());
    const associado = await assinar('ASSOCIADO', crypto.randomUUID());

    await http().get('/valores').expect(401);
    for (const token of [basico, associado]) {
      await http()
        .get('/valores')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
      await http()
        .post('/valores')
        .set('Authorization', `Bearer ${token}`)
        .send({ valorMensal: valorNovo() })
        .expect(403);
    }
  });

  it('grava o mensal com o anual calculado, no histórico e no log', async () => {
    const anterior = await alterar(valorNovo());
    const painel = await alterar('130.50');

    expect(painel.atual).toMatchObject({
      valorMensal: '130.50',
      // 12 meses com 20% de desconto (RN13).
      valorAnual: '1252.80',
      alteradoPor: { nome: 'Admin dos Valores' },
    });
    expect(painel.historico[0]).toEqual(painel.atual);
    expect(painel.historico[1]).toEqual(anterior.atual);

    const logs = await prisma.logAuditoria.findMany({
      where: { entidadeId: painel.atual!.id },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      usuarioId: adminId,
      acao: 'VALOR_ALTERADO',
      entidade: 'ValorContribuicao',
      associadoId: null,
      valorAnterior: {
        valorMensal: anterior.atual!.valorMensal,
        valorAnual: anterior.atual!.valorAnual,
      },
      valorNovo: { valorMensal: '130.50', valorAnual: '1252.80' },
    });

    const resposta = await http()
      .get('/valores')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    expect((resposta.body as PainelValores).atual).toEqual(painel.atual);
  });

  it('avisa por e-mail só quem recebe o boleto mensal, na hora (RN15)', async () => {
    const marcador = crypto.randomUUID();
    const criar = (
      nome: string,
      dados: { contribuicaoAtiva: boolean; inativadoEm?: Date },
    ) =>
      prisma.associado.create({
        data: {
          cnpj: cnpjNovo(),
          razaoSocial: `${nome} ${marcador} Ltda`,
          email: `${nome.toLowerCase()}-${marcador}@example.com`,
          ...dados,
        },
      });
    const comBoleto = await criar('Recebe', { contribuicaoAtiva: true });
    await criar('NaoRecebe', { contribuicaoAtiva: false });
    await criar('Inativado', {
      contribuicaoAtiva: true,
      inativadoEm: new Date(),
    });
    await prisma.associado.create({
      data: {
        cnpj: cnpjNovo(),
        razaoSocial: `SemEmail ${marcador} Ltda`,
        contribuicaoAtiva: true,
      },
    });

    const antes = await alterar(valorNovo());
    enviados.length = 0;
    const valor = valorNovo();
    const painel = await alterar(valor);

    const meus = enviados.filter((mensagem) => mensagem.to.includes(marcador));
    expect(meus.map((mensagem) => mensagem.to)).toEqual([comBoleto.email]);
    const mes = textoCompetencia(
      competenciaDoNovoValor(new Date(painel.atual!.alteradoEm)),
    );
    expect(meus[0].subject).toBe(
      'O valor da contribuição vai mudar - Elo Connect',
    );
    expect(meus[0].text).toContain(`Olá, Recebe ${marcador} Ltda.`);
    expect(meus[0].text).toContain(
      `Valor anterior: ${formatarReais(antes.atual!.valorMensal)} por mês.`,
    );
    expect(meus[0].text).toContain(`a partir do boleto de ${mes}`);
    // O painel conta quem recebe o aviso; os outros testes também criam
    // associados, então o total exato muda.
    expect(painel.associadosAvisados).toBeGreaterThanOrEqual(1);
  });

  it('recusa valor fora do formato, zerado ou igual ao atual (400)', async () => {
    const atual = (await alterar(valorNovo())).atual!.valorMensal;

    for (const valorMensal of ['130', '130,50', '-1.00', '1000000.00', '']) {
      await http()
        .post('/valores')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ valorMensal })
        .expect(400);
    }
    for (const valorMensal of ['0.00', atual, `0${atual}`]) {
      const resposta = await http()
        .post('/valores')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ valorMensal })
        .expect(400);
      expect(resposta.body).toMatchObject({ campo: 'valorMensal' });
    }
  });
});
