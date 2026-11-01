// Consulta do log de auditoria pela sede (US37, RF40), só para o chave mestre
// (RN33). Roda no banco de teste (preparar-banco.mjs). O log não pode ser
// apagado, então cada teste cria os próprios usuários e filtra por eles.
import 'dotenv/config';
import {
  cnpjValido,
  formatarCnpj,
  type ListaLogAuditoria,
  type UsuarioSede,
} from '@eloconnect/shared';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { EmailService } from '../src/email/email.service.js';
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

/** Hoje (AAAA-MM-DD) no horário de Mato Grosso, que é sempre -04:00. */
function diaEmMatoGrosso(deslocamentoDias = 0): string {
  const agora = Date.now() - 4 * 60 * 60 * 1000;
  return new Date(agora + deslocamentoDias * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

describe('Log de auditoria (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwt: JwtService;

  const http = () => request(app.getHttpServer());
  const assinar = (perfil: string, sub: string) =>
    jwt.signAsync(
      { perfil },
      { secret: process.env.JWT_SECRET, subject: sub, expiresIn: 300 },
    );

  /** Usuário da sede novo, com o token dele. */
  async function criarUsuarioSede(nome: string, perfil = 'ADMIN') {
    const usuario = await prisma.usuario.create({
      data: {
        email: `log-${crypto.randomUUID()}@example.com`,
        nome,
        perfil: perfil === 'ADMIN' ? 'ADMIN' : 'ADMIN_BASICO',
        senhaHash: 'x',
      },
    });
    const token = await assinar(perfil, usuario.id);
    return { ...usuario, token };
  }

  async function consultar(token: string, query: Record<string, string>) {
    const resposta = await http()
      .get('/auditoria')
      .query(query)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return resposta.body as ListaLogAuditoria;
  }

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EmailService)
      .useValue({ send: () => Promise.resolve() })
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
  });

  afterAll(() => app.close());

  it('recusa sem token (401) e para o perfil básico e o associado (403)', async () => {
    const basico = await assinar('ADMIN_BASICO', crypto.randomUUID());
    const associado = await assinar('ASSOCIADO', crypto.randomUUID());

    for (const caminho of ['/auditoria', '/auditoria/usuarios']) {
      await http().get(caminho).expect(401);
      await http()
        .get(caminho)
        .set('Authorization', `Bearer ${basico}`)
        .expect(403);
      await http()
        .get(caminho)
        .set('Authorization', `Bearer ${associado}`)
        .expect(403);
    }
  });

  it('filtra por usuário, ação e associado, da ação mais recente para a mais antiga', async () => {
    const ana = await criarUsuarioSede('Ana de Teste');
    const bruno = await criarUsuarioSede('Bruno de Teste');
    const cnpj = cnpjNovo();
    const marcador = crypto.randomUUID();
    const razaoSocial = `Farmácia Log ${marcador} Ltda`;

    const criado = await http()
      .post('/associados')
      .set('Authorization', `Bearer ${ana.token}`)
      .send({ cnpj, razaoSocial })
      .expect(201);
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const { id } = criado.body as { id: string };
    await http()
      .patch(`/associados/${id}`)
      .set('Authorization', `Bearer ${ana.token}`)
      .send({ telefone: '(65) 90000-0000' })
      .expect(200);
    await http()
      .put(`/associados/${id}/acesso`)
      .set('Authorization', `Bearer ${bruno.token}`)
      .send({ acessoManual: 'BLOQUEADO', motivo: 'Motivo fictício' })
      .expect(200);

    const daAna = await consultar(ana.token, { usuarioId: ana.id });
    expect(daAna.total).toBe(2);
    expect(daAna.itens.map((item) => item.acao)).toEqual([
      'ASSOCIADO_EDITADO',
      'ASSOCIADO_CRIADO',
    ]);
    expect(daAna.itens[0]).toMatchObject({
      usuario: { id: ana.id, nome: 'Ana de Teste' },
      associado: { id, cnpj, razaoSocial },
      valorAnterior: { telefone: null },
      valorNovo: { telefone: '(65) 90000-0000' },
    });

    const edicoes = await consultar(ana.token, {
      usuarioId: ana.id,
      acao: 'ASSOCIADO_EDITADO',
    });
    expect(edicoes.total).toBe(1);

    // Pelo nome ou pelo CNPJ com pontuação, como na lista de associados.
    for (const busca of [marcador.toUpperCase(), formatarCnpj(cnpj)]) {
      const doAssociado = await consultar(ana.token, { associado: busca });
      expect(doAssociado.itens.map((item) => item.acao)).toEqual([
        'ACESSO_BLOQUEADO',
        'ASSOCIADO_EDITADO',
        'ASSOCIADO_CRIADO',
      ]);
      expect(doAssociado.itens[0]).toMatchObject({
        usuario: { nome: 'Bruno de Teste' },
        valorNovo: { acessoManual: 'BLOQUEADO', motivo: 'Motivo fictício' },
      });
    }

    const hoje = diaEmMatoGrosso();
    expect(
      (await consultar(ana.token, { usuarioId: ana.id, de: hoje, ate: hoje }))
        .total,
    ).toBe(2);
    expect(
      (
        await consultar(ana.token, {
          usuarioId: ana.id,
          ate: diaEmMatoGrosso(-1),
        })
      ).total,
    ).toBe(0);
  });

  it('conta o período no horário de Mato Grosso, com o último dia inteiro', async () => {
    const carla = await criarUsuarioSede('Carla de Teste');
    // 10/03 em Mato Grosso vai de 04:00 de 10/03 até 03:59 de 11/03, em UTC.
    for (const ocorridoEm of [
      '2026-03-10T03:59:59.999Z',
      '2026-03-10T04:00:00.000Z',
      '2026-03-11T03:59:59.999Z',
      '2026-03-11T04:00:00.000Z',
    ]) {
      await prisma.logAuditoria.create({
        data: {
          usuarioId: carla.id,
          acao: 'VALOR_ALTERADO',
          entidade: 'ValorContribuicao',
          ocorridoEm: new Date(ocorridoEm),
        },
      });
    }

    const dia10 = await consultar(carla.token, {
      usuarioId: carla.id,
      de: '2026-03-10',
      ate: '2026-03-10',
    });
    expect(dia10.itens.map((item) => item.ocorridoEm)).toEqual([
      '2026-03-11T03:59:59.999Z',
      '2026-03-10T04:00:00.000Z',
    ]);
    // Sem associado e sem campos alterados, os dois vêm nulos.
    expect(dia10.itens[0]).toMatchObject({
      acao: 'VALOR_ALTERADO',
      associado: null,
      valorAnterior: null,
      valorNovo: null,
    });
  });

  it('mostra 20 por página', async () => {
    const davi = await criarUsuarioSede('Davi de Teste');
    await prisma.logAuditoria.createMany({
      data: Array.from({ length: 21 }, (_, i) => ({
        usuarioId: davi.id,
        acao: 'VALOR_ALTERADO',
        entidade: 'ValorContribuicao',
        ocorridoEm: new Date(Date.UTC(2026, 0, 1, 12, i)),
      })),
    });

    const primeira = await consultar(davi.token, { usuarioId: davi.id });
    expect(primeira).toMatchObject({ total: 21, pagina: 1, porPagina: 20 });
    expect(primeira.itens).toHaveLength(20);
    const segunda = await consultar(davi.token, {
      usuarioId: davi.id,
      pagina: '2',
    });
    expect(segunda.itens.map((item) => item.ocorridoEm)).toEqual([
      '2026-01-01T12:00:00.000Z',
    ]);
  });

  it('recusa filtros fora do formato (400)', async () => {
    const elisa = await criarUsuarioSede('Elisa de Teste');
    for (const query of [
      { usuarioId: 'nao-e-uuid' },
      { acao: 'OUTRA_ACAO' },
      { de: '10/03/2026' },
      { ate: '2026-02-30' },
      { pagina: '0' },
    ]) {
      await http()
        .get('/auditoria')
        .query(query)
        .set('Authorization', `Bearer ${elisa.token}`)
        .expect(400);
    }
  });

  it('lista as pessoas da sede para o filtro, sem os associados', async () => {
    const fabio = await criarUsuarioSede('Fábio de Teste');
    const gabi = await criarUsuarioSede('Gabi de Teste', 'ADMIN_BASICO');
    const associado = await prisma.associado.create({
      data: { cnpj: cnpjNovo(), razaoSocial: 'Farmácia Teste Ltda' },
    });
    const contaAssociado = await prisma.usuario.create({
      data: {
        email: `log-${crypto.randomUUID()}@example.com`,
        nome: 'Associado de Teste',
        perfil: 'ASSOCIADO',
        associadoId: associado.id,
      },
    });

    const resposta = await http()
      .get('/auditoria/usuarios')
      .set('Authorization', `Bearer ${fabio.token}`)
      .expect(200);
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const usuarios = resposta.body as UsuarioSede[];
    const ids = usuarios.map((usuario) => usuario.id);

    expect(ids).toEqual(expect.arrayContaining([fabio.id, gabi.id]));
    expect(ids).not.toContain(contaAssociado.id);
    expect(usuarios.find((usuario) => usuario.id === gabi.id)).toEqual({
      id: gabi.id,
      nome: 'Gabi de Teste',
    });
  });
});
