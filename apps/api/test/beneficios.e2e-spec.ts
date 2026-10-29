// Benefícios (US24, RF24), em dois grupos (RN32). A lista é pública; os dois
// perfis da sede cadastram, editam e removem (RN33), com registro no log
// (RN26). Roda no banco de teste (preparar-banco.mjs); os dados ficam lá,
// então cada teste usa nomes novos.
import 'dotenv/config';
import type { Beneficio, ListaLogAuditoria } from '@eloconnect/shared';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

process.env.JWT_SECRET ??= 'segredo-so-para-teste-com-mais-de-32-caracteres';

describe('Benefícios (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwt: JwtService;
  let tokenAdmin: string;
  let tokenBasico: string;
  let basicoId: string;

  const http = () => request(app.getHttpServer());
  const assinar = (perfil: string, sub: string) =>
    jwt.signAsync(
      { perfil },
      { secret: process.env.JWT_SECRET, subject: sub, expiresIn: 300 },
    );

  async function listar() {
    const resposta = await http().get('/beneficios').expect(200);
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return resposta.body as Beneficio[];
  }

  async function criar(token: string, dados: Record<string, unknown> = {}) {
    const resposta = await http()
      .post('/beneficios')
      .set('Authorization', `Bearer ${token}`)
      .send({
        titulo: `Benefício ${crypto.randomUUID()}`,
        descricao: 'Descrição fictícia.',
        grupo: 'CONSULTORIA',
        ...dados,
      })
      .expect(201);
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return resposta.body as Beneficio;
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
          email: `beneficios-${crypto.randomUUID()}@example.com`,
          nome,
          perfil,
          senhaHash: 'x',
        },
      });
    const admin = await criarUsuario('ADMIN', 'Admin de Teste');
    const basico = await criarUsuario('ADMIN_BASICO', 'Básico de Teste');
    basicoId = basico.id;
    tokenAdmin = await assinar('ADMIN', admin.id);
    tokenBasico = await assinar('ADMIN_BASICO', basico.id);
  });

  afterAll(() => app.close());

  it('a lista é pública; alterar exige a sede (401 e 403)', async () => {
    const { id } = await criar(tokenAdmin);
    const associado = await assinar('ASSOCIADO', crypto.randomUUID());

    expect((await listar()).map((b) => b.id)).toContain(id);
    await http().post('/beneficios').send({}).expect(401);
    await http().patch(`/beneficios/${id}`).send({}).expect(401);
    await http().delete(`/beneficios/${id}`).expect(401);
    await http()
      .post('/beneficios')
      .set('Authorization', `Bearer ${associado}`)
      .send({ titulo: 'X', descricao: 'Y', grupo: 'CONSULTORIA' })
      .expect(403);
    await http()
      .delete(`/beneficios/${id}`)
      .set('Authorization', `Bearer ${associado}`)
      .expect(403);
  });

  it('o perfil básico cadastra, edita e remove, com tudo no log (RN33)', async () => {
    const titulo = `Assessoria ${crypto.randomUUID()}`;
    const criado = await criar(tokenBasico, {
      titulo: `  ${titulo}  `,
      grupo: 'ASSESSORIA_JURIDICA',
    });
    expect(criado).toEqual({
      id: criado.id,
      titulo,
      descricao: 'Descrição fictícia.',
      grupo: 'ASSESSORIA_JURIDICA',
    });

    const editado = await http()
      .patch(`/beneficios/${criado.id}`)
      .set('Authorization', `Bearer ${tokenBasico}`)
      .send({ titulo, descricao: 'Outra descrição.', grupo: 'CONSULTORIA' })
      .expect(200);
    expect(editado.body).toMatchObject({
      descricao: 'Outra descrição.',
      grupo: 'CONSULTORIA',
    });

    await http()
      .delete(`/beneficios/${criado.id}`)
      .set('Authorization', `Bearer ${tokenBasico}`)
      .expect(200);
    expect((await listar()).map((b) => b.id)).not.toContain(criado.id);
    // Remover só desliga: o registro fica para o log.
    await expect(
      prisma.beneficio.findUnique({ where: { id: criado.id } }),
    ).resolves.toMatchObject({ ativo: false });

    const logs = await prisma.logAuditoria.findMany({
      where: { entidadeId: criado.id },
      orderBy: { ocorridoEm: 'asc' },
    });
    expect(logs.map((log) => log.acao)).toEqual([
      'BENEFICIO_CRIADO',
      'BENEFICIO_EDITADO',
      'BENEFICIO_REMOVIDO',
    ]);
    expect(logs[0]).toMatchObject({
      usuarioId: basicoId,
      entidade: 'Beneficio',
      valorNovo: { titulo, grupo: 'ASSESSORIA_JURIDICA' },
    });
    // Só o que mudou: o título enviado igual fica de fora.
    expect(logs[1]).toMatchObject({
      valorAnterior: {
        descricao: 'Descrição fictícia.',
        grupo: 'ASSESSORIA_JURIDICA',
      },
      valorNovo: { descricao: 'Outra descrição.', grupo: 'CONSULTORIA' },
    });

    // A consulta do log diz qual benefício cada ação afetou.
    const consulta = await http()
      .get('/auditoria')
      .query({ usuarioId: basicoId })
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const { itens } = consulta.body as ListaLogAuditoria;
    expect(itens.map((log) => log.registro)).toEqual([
      { tipo: 'Benefício', nome: titulo },
      { tipo: 'Benefício', nome: titulo },
      { tipo: 'Benefício', nome: titulo },
    ]);
  });

  it('lista os ativos na ordem de cadastro', async () => {
    const primeiro = await criar(tokenAdmin);
    const segundo = await criar(tokenAdmin, { grupo: 'ASSESSORIA_JURIDICA' });

    const ids = (await listar()).map((b) => b.id);
    expect(ids.indexOf(primeiro.id)).toBeLessThan(ids.indexOf(segundo.id));
  });

  it('recusa campos vazios, grupo desconhecido e benefício removido', async () => {
    for (const dados of [
      { titulo: '   ' },
      { descricao: '' },
      { grupo: 'OUTRO' },
      { titulo: 'x'.repeat(121) },
    ]) {
      await http()
        .post('/beneficios')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({
          titulo: 'Benefício',
          descricao: 'Descrição.',
          grupo: 'CONSULTORIA',
          ...dados,
        })
        .expect(400);
    }

    const { id } = await criar(tokenAdmin);
    await http()
      .patch(`/beneficios/${id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ titulo: '' })
      .expect(400);
    await http()
      .delete(`/beneficios/${id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);
    await http()
      .patch(`/beneficios/${id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ titulo: 'Outro' })
      .expect(404);
    await http()
      .delete(`/beneficios/${id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(404);
  });
});
