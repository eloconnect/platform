// Convenções coletivas (RF21, RF22, RN12). Os dois perfis da sede criam,
// enviam os PDFs e publicam (RN33), com registro no log (RN26). O associado vê
// só as publicadas, e o PDF integral só se está em dia. Roda no banco de teste
// (preparar-banco.mjs), com os PDFs numa pasta temporária.
import 'dotenv/config';
import { mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  cnpjValido,
  type Convencao,
  type ListaLogAuditoria,
} from '@eloconnect/shared';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

process.env.JWT_SECRET ??= 'segredo-so-para-teste-com-mais-de-32-caracteres';
// Sem o Vercel Blob: os PDFs vão para uma pasta só deste teste.
delete process.env.BLOB_READ_WRITE_TOKEN;
delete process.env.BLOB_STORE_ID;
delete process.env.VERCEL;
const PASTA = mkdtempSync(join(tmpdir(), 'eloconnect-convencoes-'));
process.env.ARQUIVOS_DIR = PASTA;

const INTEGRAL = Buffer.from('%PDF-1.4\n% PDF integral fictício\n%%EOF\n');
const RESUMIDA = Buffer.from('%PDF-1.4\n% PDF resumido fictício\n%%EOF\n');

/** CNPJ numérico válido e diferente a cada chamada. */
function cnpjNovo(): string {
  const base = String(Math.floor(Math.random() * 1e12)).padStart(12, '0');
  for (let dv = 0; dv < 100; dv++) {
    const cnpj = base + String(dv).padStart(2, '0');
    if (cnpjValido(cnpj)) return cnpj;
  }
  throw new Error('Não achei os dígitos verificadores.');
}

/** Arquivos guardados na pasta para uma convenção. */
function arquivosDa(id: string): string[] {
  return readdirSync(PASTA, { recursive: true, withFileTypes: true })
    .filter((item) => item.isFile() && item.parentPath.includes(id))
    .map((item) => join(item.parentPath, item.name));
}

describe('Convenções (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwt: JwtService;
  let tokenAdmin: string;
  let tokenBasico: string;
  let tokenEmDia: string;
  let tokenInadimplente: string;
  let basicoId: string;

  const http = () => request(app.getHttpServer());
  const assinar = (perfil: string, sub: string) =>
    jwt.signAsync(
      { perfil },
      { secret: process.env.JWT_SECRET, subject: sub, expiresIn: 300 },
    );

  async function criar(titulo = `Convenção ${crypto.randomUUID()}`) {
    const resposta = await http()
      .post('/convencoes')
      .set('Authorization', `Bearer ${tokenBasico}`)
      .send({ titulo, ano: 2026, resumo: 'O que mudou: texto fictício.' })
      .expect(201);
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return resposta.body as Convencao;
  }

  function enviarPdfs(
    id: string,
    arquivos: { integral?: Buffer; resumida?: Buffer },
    nomes = { integral: 'Convenção integral.pdf', resumida: 'Resumo.pdf' },
  ) {
    let chamada = http()
      .post(`/convencoes/${id}/anexos`)
      .set('Authorization', `Bearer ${tokenBasico}`);
    if (arquivos.integral) {
      chamada = chamada.attach('integral', arquivos.integral, {
        filename: nomes.integral,
        contentType: 'application/pdf',
      });
    }
    if (arquivos.resumida) {
      chamada = chamada.attach('resumida', arquivos.resumida, {
        filename: nomes.resumida,
        contentType: 'application/pdf',
      });
    }
    return chamada;
  }

  function publicar(id: string) {
    return http()
      .post(`/convencoes/${id}/publicar`)
      .set('Authorization', `Bearer ${tokenBasico}`);
  }

  /** Convenção já publicada, com os dois PDFs. */
  async function publicada() {
    const convencao = await criar();
    await enviarPdfs(convencao.id, {
      integral: INTEGRAL,
      resumida: RESUMIDA,
    }).expect(201);
    await publicar(convencao.id).expect(201);
    return convencao;
  }

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
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

    const criarUsuario = (
      perfil: 'ADMIN' | 'ADMIN_BASICO' | 'ASSOCIADO',
      nome: string,
      associadoId?: string,
    ) =>
      prisma.usuario.create({
        data: {
          email: `convencoes-${crypto.randomUUID()}@example.com`,
          nome,
          perfil,
          senhaHash: 'x',
          associadoId,
        },
      });
    const criarAssociado = (situacao: 'ADIMPLENTE' | 'INADIMPLENTE') =>
      prisma.associado.create({
        data: {
          cnpj: cnpjNovo(),
          razaoSocial: `Farmácia de Teste ${situacao}`,
          situacao,
        },
      });

    const admin = await criarUsuario('ADMIN', 'Admin de Teste');
    const basico = await criarUsuario('ADMIN_BASICO', 'Básico de Teste');
    const emDia = await criarUsuario(
      'ASSOCIADO',
      'Associado em dia',
      (await criarAssociado('ADIMPLENTE')).id,
    );
    const inadimplente = await criarUsuario(
      'ASSOCIADO',
      'Associado inadimplente',
      (await criarAssociado('INADIMPLENTE')).id,
    );
    basicoId = basico.id;
    tokenAdmin = await assinar('ADMIN', admin.id);
    tokenBasico = await assinar('ADMIN_BASICO', basico.id);
    tokenEmDia = await assinar('ASSOCIADO', emDia.id);
    tokenInadimplente = await assinar('ASSOCIADO', inadimplente.id);
  });

  afterAll(() => app.close());

  it('a sede gerencia; o associado só consulta (401 e 403)', async () => {
    const { id } = await criar();

    await http().get('/convencoes').expect(401);
    await http().get('/associado/convencoes').expect(401);
    for (const [metodo, caminho] of [
      ['get', '/convencoes'],
      ['post', '/convencoes'],
      ['patch', `/convencoes/${id}`],
      ['post', `/convencoes/${id}/anexos`],
      ['post', `/convencoes/${id}/publicar`],
      ['get', `/convencoes/${id}/anexos/INTEGRAL`],
    ] as const) {
      const chamada = http()[metodo](caminho);
      await chamada.set('Authorization', `Bearer ${tokenEmDia}`).expect(403);
    }
    await http()
      .get('/associado/convencoes')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(403);
    // A remoção saiu desta entrega.
    await http()
      .delete(`/convencoes/${id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(404);
  });

  it('o perfil básico cria, envia os PDFs e publica, com tudo no log (RN33)', async () => {
    const titulo = `Convenção ${crypto.randomUUID()}`;
    const { id } = await criar(titulo);

    // Rascunho: o associado não vê.
    const antes = await http()
      .get('/associado/convencoes')
      .set('Authorization', `Bearer ${tokenEmDia}`)
      .expect(200);
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    expect((antes.body as Convencao[]).map((c) => c.id)).not.toContain(id);

    // Sem os PDFs, não publica.
    const semPdf = await publicar(id).expect(400);
    expect(semPdf.body.message).toBe(
      'Envie o PDF integral e o resumido antes de publicar.',
    );
    // No primeiro envio, vão os dois.
    await enviarPdfs(id, { resumida: RESUMIDA }).expect(400);
    const comOsDois = await enviarPdfs(id, {
      integral: INTEGRAL,
      resumida: RESUMIDA,
    }).expect(201);
    expect(
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      (comOsDois.body as Convencao).anexos.map((a) => a.tipo).toSorted(),
    ).toEqual(['INTEGRAL', 'RESUMIDA']);

    // A sede abre o PDF do rascunho para conferir.
    const pdf = await http()
      .get(`/convencoes/${id}/anexos/INTEGRAL`)
      .set('Authorization', `Bearer ${tokenBasico}`)
      .buffer(true)
      .expect(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect(pdf.body).toEqual(INTEGRAL);

    await publicar(id).expect(201);
    await publicar(id).expect(400);

    const depois = await http()
      .get('/associado/convencoes')
      .set('Authorization', `Bearer ${tokenEmDia}`)
      .expect(200);
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    expect((depois.body as Convencao[]).map((c) => c.id)).toContain(id);

    const logs = await prisma.logAuditoria.findMany({
      where: { entidadeId: id },
      orderBy: { ocorridoEm: 'asc' },
    });
    expect(logs.map((log) => log.acao)).toEqual([
      'CONVENCAO_CRIADA',
      'CONVENCAO_ANEXOS_ATUALIZADOS',
      'CONVENCAO_PUBLICADA',
    ]);
    expect(logs[1]).toMatchObject({
      usuarioId: basicoId,
      valorNovo: {
        pdfIntegral: 'Convenção integral.pdf',
        pdfResumido: 'Resumo.pdf',
      },
    });

    // A consulta do log diz qual convenção cada ação afetou.
    const consulta = await http()
      .get('/auditoria')
      .query({ usuarioId: basicoId, acao: 'CONVENCAO_PUBLICADA' })
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const { itens } = consulta.body as ListaLogAuditoria;
    expect(itens[0].registro).toEqual({ tipo: 'Convenção', nome: titulo });
  });

  it('quem está em dia recebe o integral; os demais, o resumido (RN12)', async () => {
    const { id } = await publicada();

    const emDia = await http()
      .get(`/associado/convencoes/${id}/anexos/INTEGRAL`)
      .set('Authorization', `Bearer ${tokenEmDia}`)
      .buffer(true)
      .expect(200);
    expect(emDia.body).toEqual(INTEGRAL);

    const inadimplente = await http()
      .get(`/associado/convencoes/${id}/anexos/INTEGRAL`)
      .set('Authorization', `Bearer ${tokenInadimplente}`)
      .buffer(true)
      .expect(200);
    expect(inadimplente.body).toEqual(RESUMIDA);
  });

  it('trocar um PDF apaga o arquivo anterior', async () => {
    const { id } = await criar();
    await enviarPdfs(id, { integral: INTEGRAL, resumida: RESUMIDA }).expect(
      201,
    );
    const antes = arquivosDa(id);
    expect(antes).toHaveLength(2);

    await enviarPdfs(id, { integral: INTEGRAL }).expect(201);

    const depois = arquivosDa(id);
    expect(depois).toHaveLength(2);
    expect(depois).not.toEqual(antes);
  });

  it('recusa arquivo que não é PDF e PDF grande demais', async () => {
    const { id } = await criar();

    await enviarPdfs(id, {
      integral: Buffer.from('não é PDF'),
      resumida: RESUMIDA,
    }).expect(400);
    await enviarPdfs(id, {
      integral: Buffer.concat([INTEGRAL, Buffer.alloc(4 * 1024 * 1024)]),
      resumida: RESUMIDA,
    }).expect(413);
    expect(arquivosDa(id)).toEqual([]);
  });
});
