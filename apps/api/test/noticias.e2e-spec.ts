// Notícias (RF35, RF41). Qualquer associado logado lê o feed, em dia ou não
// (RN28); visitante não. Os dois perfis da sede publicam, editam e removem
// (RN33), com registro no log (RN26). Roda no banco de teste
// (preparar-banco.mjs); os dados ficam lá, então cada teste usa nomes novos.
import 'dotenv/config';
import type { ListaLogAuditoria, Noticia } from '@eloconnect/shared';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

process.env.JWT_SECRET ??= 'segredo-so-para-teste-com-mais-de-32-caracteres';

describe('Notícias (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwt: JwtService;
  let tokenAdmin: string;
  let tokenBasico: string;
  let tokenAssociado: string;
  let adminId: string;
  let basicoId: string;

  const http = () => request(app.getHttpServer());
  const assinar = (perfil: string, sub: string) =>
    jwt.signAsync(
      { perfil },
      { secret: process.env.JWT_SECRET, subject: sub, expiresIn: 300 },
    );

  async function listar(token: string) {
    const resposta = await http()
      .get('/noticias')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return resposta.body as Noticia[];
  }

  async function publicar(token: string, dados: Record<string, unknown> = {}) {
    const resposta = await http()
      .post('/noticias')
      .set('Authorization', `Bearer ${token}`)
      .send({
        titulo: `Notícia ${crypto.randomUUID()}`,
        conteudo: 'Texto fictício.',
        ...dados,
      })
      .expect(201);
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return resposta.body as Noticia;
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

    const criarUsuario = (perfil: 'ADMIN' | 'ADMIN_BASICO', nome: string) =>
      prisma.usuario.create({
        data: {
          email: `noticias-${crypto.randomUUID()}@example.com`,
          nome,
          perfil,
          senhaHash: 'x',
        },
      });
    const admin = await criarUsuario('ADMIN', 'Admin de Teste');
    const basico = await criarUsuario('ADMIN_BASICO', 'Básico de Teste');
    adminId = admin.id;
    basicoId = basico.id;
    tokenAdmin = await assinar('ADMIN', admin.id);
    tokenBasico = await assinar('ADMIN_BASICO', basico.id);
    // O feed não depende da situação do associado (RN28): basta o login.
    tokenAssociado = await assinar('ASSOCIADO', crypto.randomUUID());
  });

  afterAll(() => app.close());

  it('o feed exige login; publicar exige a sede (401 e 403)', async () => {
    const { id } = await publicar(tokenAdmin);

    await http().get('/noticias').expect(401);
    await http().post('/noticias').send({}).expect(401);
    await http().patch(`/noticias/${id}`).send({}).expect(401);
    await http().delete(`/noticias/${id}`).expect(401);
    await http()
      .post('/noticias')
      .set('Authorization', `Bearer ${tokenAssociado}`)
      .send({ titulo: 'X', conteudo: 'Y' })
      .expect(403);
    await http()
      .patch(`/noticias/${id}`)
      .set('Authorization', `Bearer ${tokenAssociado}`)
      .send({ titulo: 'X' })
      .expect(403);
    await http()
      .delete(`/noticias/${id}`)
      .set('Authorization', `Bearer ${tokenAssociado}`)
      .expect(403);
  });

  it('o associado e a sede veem o feed, da mais recente para a mais antiga', async () => {
    const antiga = await publicar(tokenAdmin);
    const nova = await publicar(tokenAdmin);

    for (const token of [tokenAssociado, tokenBasico, tokenAdmin]) {
      const ids = (await listar(token)).map((n) => n.id);
      expect(ids.indexOf(nova.id)).toBeLessThan(ids.indexOf(antiga.id));
      expect(ids.indexOf(nova.id)).toBeGreaterThanOrEqual(0);
    }
    expect(new Date(nova.publicadaEm).getTime()).toBeGreaterThanOrEqual(
      new Date(antiga.publicadaEm).getTime(),
    );
  });

  it('rascunho não aparece no feed nem pode ser editado', async () => {
    const rascunho = await prisma.noticia.create({
      data: {
        titulo: `Rascunho ${crypto.randomUUID()}`,
        conteudo: 'Texto fictício.',
        autorId: adminId,
      },
    });

    expect((await listar(tokenAssociado)).map((n) => n.id)).not.toContain(
      rascunho.id,
    );
    await http()
      .patch(`/noticias/${rascunho.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ titulo: 'Outro' })
      .expect(404);
  });

  it('o perfil básico publica, edita e remove, com tudo no log (RN33)', async () => {
    const titulo = `Notícia ${crypto.randomUUID()}`;
    const publicada = await publicar(tokenBasico, {
      titulo: `  ${titulo}  `,
      conteudo: 'Primeira linha.\nSegunda linha.',
    });
    expect(publicada).toEqual({
      id: publicada.id,
      titulo,
      conteudo: 'Primeira linha.\nSegunda linha.',
      publicadaEm: expect.any(String),
    });

    const editada = await http()
      .patch(`/noticias/${publicada.id}`)
      .set('Authorization', `Bearer ${tokenBasico}`)
      .send({ titulo, conteudo: 'Outro texto.' })
      .expect(200);
    // A data continua a da publicação.
    expect(editada.body).toEqual({ ...publicada, conteudo: 'Outro texto.' });

    await http()
      .delete(`/noticias/${publicada.id}`)
      .set('Authorization', `Bearer ${tokenBasico}`)
      .expect(200);
    expect((await listar(tokenAssociado)).map((n) => n.id)).not.toContain(
      publicada.id,
    );
    // Remover só tira do feed: o registro fica para o log.
    const registro = await prisma.noticia.findUnique({
      where: { id: publicada.id },
    });
    expect(registro?.removidaEm).toBeInstanceOf(Date);

    const logs = await prisma.logAuditoria.findMany({
      where: { entidadeId: publicada.id },
      orderBy: { ocorridoEm: 'asc' },
    });
    expect(logs.map((log) => log.acao)).toEqual([
      'NOTICIA_PUBLICADA',
      'NOTICIA_EDITADA',
      'NOTICIA_REMOVIDA',
    ]);
    expect(logs[0]).toMatchObject({
      usuarioId: basicoId,
      entidade: 'Noticia',
      valorNovo: { titulo, conteudo: 'Primeira linha.\nSegunda linha.' },
    });
    // Só o que mudou: o título enviado igual fica de fora.
    expect(logs[1]).toMatchObject({
      valorAnterior: { conteudo: 'Primeira linha.\nSegunda linha.' },
      valorNovo: { conteudo: 'Outro texto.' },
    });

    // A consulta do log diz qual notícia cada ação afetou.
    const consulta = await http()
      .get('/auditoria')
      .query({ usuarioId: basicoId })
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const { itens } = consulta.body as ListaLogAuditoria;
    expect(itens.map((log) => log.registro)).toEqual([
      { tipo: 'Notícia', nome: titulo },
      { tipo: 'Notícia', nome: titulo },
      { tipo: 'Notícia', nome: titulo },
    ]);
  });

  it('recusa campos vazios, texto longo demais e notícia removida', async () => {
    for (const dados of [
      { titulo: '   ' },
      { conteudo: '' },
      { titulo: 'x'.repeat(151) },
      { conteudo: 'x'.repeat(10001) },
    ]) {
      await http()
        .post('/noticias')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ titulo: 'Notícia', conteudo: 'Texto.', ...dados })
        .expect(400);
    }

    const { id } = await publicar(tokenAdmin);
    await http()
      .patch(`/noticias/${id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ conteudo: ' ' })
      .expect(400);
    await http()
      .delete(`/noticias/${id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);
    await http()
      .patch(`/noticias/${id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ titulo: 'Outro' })
      .expect(404);
    await http()
      .delete(`/noticias/${id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(404);
  });
});
