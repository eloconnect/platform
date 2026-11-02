// Carga inicial dos associados pela planilha modelo (RF42, O7). Roda no banco
// de teste (preparar-banco.mjs), com CNPJs fictícios gerados aqui.
import 'dotenv/config';
import type { ResultadoImportacao } from '@eloconnect/shared';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

process.env.JWT_SECRET ??= 'segredo-so-para-teste-com-mais-de-32-caracteres';

const CABECALHO =
  'CNPJ;Razão social;Nome fantasia;E-mail;Telefone;Município;Recebe boleto mensal';

/** Dígito verificador do CNPJ, pelo cálculo da Receita. */
function digito(base: string): number {
  let soma = 0;
  for (let i = 0; i < base.length; i++) {
    soma += (base.charCodeAt(i) - 48) * (((base.length - 1 - i) % 8) + 2);
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

/** CNPJ fictício e válido, diferente a cada chamada. */
function cnpjFicticio(): string {
  const base = `${crypto.randomUUID().replace(/\D/g, '').padEnd(8, '0').slice(0, 8)}0001`;
  const primeiro = digito(base);
  return `${base}${primeiro}${digito(`${base}${primeiro}`)}`;
}

describe('Importação de associados (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwt: JwtService;
  let adminId: string;
  let tokenAdmin: string;
  /** CNPJs importados aqui, que saem do lote no fim. */
  const importados: string[] = [];

  const http = () => request(app.getHttpServer());
  const assinar = (perfil: string, sub = crypto.randomUUID()) =>
    jwt.signAsync(
      { perfil },
      { secret: process.env.JWT_SECRET, subject: sub, expiresIn: 300 },
    );
  const enviar = (conteudo: Buffer | string) =>
    http()
      .post('/associados/importacao')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .attach('planilha', Buffer.from(conteudo), 'associados.csv');

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = modulo.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
    ({ id: adminId } = await prisma.usuario.create({
      data: {
        email: `importacao-admin-${crypto.randomUUID()}@example.com`,
        nome: 'Admin da Importação',
        perfil: 'ADMIN',
        senhaHash: 'x',
      },
    }));
    tokenAdmin = await assinar('ADMIN', adminId);
  });

  afterAll(async () => {
    // Os associados deste teste não entram nos lotes dos outros testes.
    await prisma.associado.updateMany({
      where: { cnpj: { in: importados } },
      data: { contribuicaoAtiva: false },
    });
    await app.close();
  });

  it('só o chave mestre importa, e a planilha é obrigatória', async () => {
    const tokenBasico = await assinar('ADMIN_BASICO');

    const semToken = await http().post('/associados/importacao');
    // Sem arquivo: o servidor recusa antes de ler o envio.
    const basico = await http()
      .post('/associados/importacao')
      .set('Authorization', `Bearer ${tokenBasico}`);
    const semArquivo = await http()
      .post('/associados/importacao')
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect([semToken.status, basico.status, semArquivo.status]).toEqual([
      401, 403, 400,
    ]);
    expect(semArquivo.body.message).toBe('Escolha a planilha.');
  });

  it('cadastra todos: quem recebe o boleto entra em dia, e cada um vai para o log', async () => {
    const pagante = cnpjFicticio();
    const outro = cnpjFicticio();
    importados.push(pagante, outro);
    // O Excel em português salva o CSV em Windows-1252.
    const arquivo = Buffer.from(
      [
        CABECALHO,
        `${pagante};Farmácia Importada Ltda;Drogaria Importada;importada@example.com;;Cuiabá;sim`,
        `${outro};Farmácia Sem Boleto Ltda;;;;;não`,
      ].join('\r\n'),
      'latin1',
    );

    const { body } = await enviar(arquivo).expect(200);

    expect(body as ResultadoImportacao).toEqual({
      importados: 2,
      recebemBoleto: 1,
      erros: [],
    });
    const [comBoleto, semBoleto] = await Promise.all(
      [pagante, outro].map((cnpj) =>
        prisma.associado.findUniqueOrThrow({ where: { cnpj } }),
      ),
    );
    expect(comBoleto).toMatchObject({
      razaoSocial: 'Farmácia Importada Ltda',
      municipio: 'Cuiabá',
      contribuicaoAtiva: true,
      situacao: 'ADIMPLENTE',
    });
    expect(semBoleto).toMatchObject({
      contribuicaoAtiva: false,
      situacao: 'INADIMPLENTE',
    });
    const log = await prisma.logAuditoria.findFirstOrThrow({
      where: { associadoId: comBoleto.id },
    });
    expect(log).toMatchObject({
      usuarioId: adminId,
      acao: 'ASSOCIADO_IMPORTADO',
      valorNovo: expect.objectContaining({
        cnpj: pagante,
        contribuicaoAtiva: true,
      }),
    });

    // Enviar a mesma planilha de novo não duplica ninguém.
    const repetida = await enviar(arquivo).expect(200);
    expect(repetida.body as ResultadoImportacao).toEqual({
      importados: 0,
      recebemBoleto: 0,
      erros: [
        { linha: 2, mensagem: 'Este CNPJ já está no cadastro.' },
        { linha: 3, mensagem: 'Este CNPJ já está no cadastro.' },
      ],
    });
  });

  it('com uma linha errada, nada entra', async () => {
    const valido = cnpjFicticio();

    const { body } = await enviar(
      [CABECALHO, `${valido};Farmácia Boa Ltda;;;;;sim`, '123;;;;;;sim'].join(
        '\n',
      ),
    ).expect(200);

    expect(body as ResultadoImportacao).toEqual({
      importados: 0,
      recebemBoleto: 0,
      erros: [{ linha: 3, mensagem: 'CNPJ inválido. Falta a razão social.' }],
    });
    expect(await prisma.associado.count({ where: { cnpj: valido } })).toBe(0);
  });
});
