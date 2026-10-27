// Cadastro, edição e inativação de associados pela sede (US08, RF08), com o
// registro de cada ação no log de auditoria (RN26). Roda no banco de teste
// (preparar-banco.ts); os dados ficam lá, então cada teste usa CNPJs novos.
import 'dotenv/config';
import { cnpjValido } from '@eloconnect/shared';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
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

describe('Associados (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tokenAdmin: string;
  let tokenAssociado: string;
  let adminId: string;

  const http = () => request(app.getHttpServer());
  const comoAdmin = (req: request.Test) =>
    req.set('Authorization', `Bearer ${tokenAdmin}`);
  const logsDo = (associadoId: string) =>
    prisma.logAuditoria.findMany({
      where: { associadoId },
      orderBy: { ocorridoEm: 'asc' },
    });

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

    const sufixo = crypto.randomUUID();
    const admin = await prisma.usuario.create({
      data: {
        email: `admin-${sufixo}@example.com`,
        nome: 'Admin de Teste',
        perfil: 'ADMIN',
        senhaHash: 'x',
      },
    });
    adminId = admin.id;
    const jwt = app.get(JwtService);
    const assinar = (perfil: string, sub: string) =>
      jwt.signAsync(
        { perfil },
        { secret: process.env.JWT_SECRET, subject: sub, expiresIn: 300 },
      );
    tokenAdmin = await assinar('ADMIN', admin.id);
    tokenAssociado = await assinar('ASSOCIADO', crypto.randomUUID());
  });

  afterAll(() => app.close());

  async function criar(dados: Record<string, unknown> = {}) {
    const resposta = await comoAdmin(http().post('/associados')).send({
      cnpj: cnpjNovo(),
      razaoSocial: 'Farmácia Teste Ltda',
      ...dados,
    });
    expect(resposta.status).toBe(201);
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return resposta.body as { id: string; cnpj: string };
  }

  it('recusa sem token (401) e com token de associado (403)', async () => {
    await http().post('/associados').send({}).expect(401);
    await http()
      .post('/associados')
      .set('Authorization', `Bearer ${tokenAssociado}`)
      .send({})
      .expect(403);
  });

  it('cadastra com o CNPJ normalizado e grava no log', async () => {
    const cnpj = cnpjNovo();
    const formatado = `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`;
    const associado = await criar({
      cnpj: formatado,
      municipio: 'Cuiabá',
      contribuicaoAtiva: true,
    });

    expect(associado).toMatchObject({
      cnpj,
      municipio: 'Cuiabá',
      contribuicaoAtiva: true,
      situacao: 'INADIMPLENTE',
      acessoManual: null,
      inativadoEm: null,
    });
    const logs = await logsDo(associado.id);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      usuarioId: adminId,
      acao: 'ASSOCIADO_CRIADO',
      entidade: 'Associado',
      entidadeId: associado.id,
      valorNovo: {
        cnpj,
        razaoSocial: 'Farmácia Teste Ltda',
        municipio: 'Cuiabá',
        contribuicaoAtiva: true,
      },
    });
  });

  it('aceita CNPJ alfanumérico', async () => {
    // Um CNPJ só pode ser cadastrado uma vez, e o banco de teste guarda os
    // dados entre as execuções.
    const existente = await prisma.associado.findUnique({
      where: { cnpj: '12ABC34501DE35' },
    });
    if (!existente) {
      const associado = await criar({ cnpj: '12.ABC.345/01DE-35' });
      expect(associado.cnpj).toBe('12ABC34501DE35');
    }
  });

  it('recusa CNPJ inválido (400) e CNPJ repetido (409)', async () => {
    await comoAdmin(http().post('/associados'))
      .send({ cnpj: '11.222.333/0001-82', razaoSocial: 'Farmácia Teste' })
      .expect(400);

    const { cnpj } = await criar();
    const resposta = await comoAdmin(http().post('/associados'))
      .send({ cnpj, razaoSocial: 'Outra Farmácia' })
      .expect(409);
    expect(resposta.body.message).toBe('Já existe um associado com este CNPJ.');
  });

  it('busca pelo id (200), id inexistente (404) e id inválido (400)', async () => {
    const { id } = await criar();
    await comoAdmin(http().get(`/associados/${id}`)).expect(200);
    await comoAdmin(http().get(`/associados/${crypto.randomUUID()}`)).expect(
      404,
    );
    await comoAdmin(http().get('/associados/nao-e-uuid')).expect(400);
  });

  it('edita e grava só o que mudou; a contribuição tem ação própria', async () => {
    const { id } = await criar({ telefone: '(65) 90000-0000' });

    await comoAdmin(http().patch(`/associados/${id}`))
      .send({
        razaoSocial: 'Farmácia Teste Ltda',
        telefone: '(65) 91111-1111',
        nomeFantasia: '',
        contribuicaoAtiva: true,
      })
      .expect(200);
    await comoAdmin(http().patch(`/associados/${id}`))
      .send({ contribuicaoAtiva: false })
      .expect(200);
    // Sem mudança: não grava nada.
    await comoAdmin(http().patch(`/associados/${id}`))
      .send({ telefone: '(65) 91111-1111' })
      .expect(200);

    const logs = await logsDo(id);
    expect(logs.map((log) => log.acao)).toEqual([
      'ASSOCIADO_CRIADO',
      'ASSOCIADO_EDITADO',
      'CONTRIBUICAO_ATIVADA',
      'CONTRIBUICAO_INTERROMPIDA',
    ]);
    expect(logs[1]).toMatchObject({
      valorAnterior: { telefone: '(65) 90000-0000' },
      valorNovo: { telefone: '(65) 91111-1111' },
    });
    expect(logs[2]).toMatchObject({
      valorAnterior: { contribuicaoAtiva: false },
      valorNovo: { contribuicaoAtiva: true },
    });
  });

  it('não deixa apagar o CNPJ nem a razão social', async () => {
    const { id } = await criar();
    await comoAdmin(http().patch(`/associados/${id}`))
      .send({ cnpj: null })
      .expect(400);
    await comoAdmin(http().patch(`/associados/${id}`))
      .send({ razaoSocial: '  ' })
      .expect(400);
  });

  it('inativa e reativa, gravando cada mudança uma vez', async () => {
    const { id } = await criar();

    const inativado = await comoAdmin(
      http().post(`/associados/${id}/inativar`),
    ).expect(200);
    expect(inativado.body.inativadoEm).not.toBeNull();
    await comoAdmin(http().post(`/associados/${id}/inativar`)).expect(200);

    const reativado = await comoAdmin(
      http().post(`/associados/${id}/reativar`),
    ).expect(200);
    expect(reativado.body.inativadoEm).toBeNull();

    const logs = await logsDo(id);
    expect(logs.map((log) => log.acao)).toEqual([
      'ASSOCIADO_CRIADO',
      'ASSOCIADO_INATIVADO',
      'ASSOCIADO_REATIVADO',
    ]);
  });
});
