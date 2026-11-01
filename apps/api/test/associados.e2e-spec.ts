// Lista, perfil, cadastro, edição e inativação de associados pela sede (US06,
// US07, US08: RF06 a RF08), com o registro de cada ação no log de auditoria
// (RN26). Roda no banco de teste (preparar-banco.mjs); os dados ficam lá, então
// cada teste usa CNPJs e nomes novos.
import 'dotenv/config';
import {
  cnpjValido,
  type AssociadoDetalhe,
  type ListaAssociados,
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

const idsDe = (lista: ListaAssociados) => lista.itens.map((item) => item.id);

describe('Associados (e2e)', () => {
  // E-mails "enviados" pela API, no lugar do SMTP.
  const enviados: EmailMessage[] = [];
  const send = (mensagem: EmailMessage) => {
    enviados.push(mensagem);
    return Promise.resolve();
  };
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tokenAdmin: string;
  let tokenAssociado: string;
  let tokenBasico: string;
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
    tokenBasico = await assinar('ADMIN_BASICO', crypto.randomUUID());
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

  it('o perfil básico da sede consulta, mas não altera (RN33)', async () => {
    const { id } = await criar();
    const comoBasico = (req: request.Test) =>
      req.set('Authorization', `Bearer ${tokenBasico}`);

    await comoBasico(http().get('/associados')).expect(200);
    await comoBasico(http().get(`/associados/${id}`)).expect(200);
    await comoBasico(http().post('/associados'))
      .send({ cnpj: cnpjNovo(), razaoSocial: 'Farmácia Teste Ltda' })
      .expect(403);
    await comoBasico(http().patch(`/associados/${id}`))
      .send({ razaoSocial: 'Outra Razão Social' })
      .expect(403);
    await comoBasico(http().post(`/associados/${id}/inativar`)).expect(403);
    await comoBasico(http().put(`/associados/${id}/acesso`))
      .send({ acessoManual: 'BLOQUEADO', motivo: 'Motivo fictício' })
      .expect(403);
    expect(await logsDo(id)).toHaveLength(1);
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

  it('o perfil traz as solicitações de cancelamento, da mais recente (RF07)', async () => {
    const { id } = await criar();
    await prisma.solicitacaoCancelamento.create({
      data: {
        associadoId: id,
        status: 'RECUSADA',
        motivo: 'Primeiro pedido',
        observacaoSede: 'Observação fictícia',
        solicitadaEm: new Date('2026-09-01T12:00:00Z'),
        decididaEm: new Date('2026-09-02T12:00:00Z'),
        decididaPorId: adminId,
      },
    });
    await prisma.solicitacaoCancelamento.create({
      data: {
        associadoId: id,
        solicitadaEm: new Date('2026-10-01T12:00:00Z'),
      },
    });

    const resposta = await comoAdmin(http().get(`/associados/${id}`)).expect(
      200,
    );
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const perfil = resposta.body as AssociadoDetalhe;
    expect(perfil.id).toBe(id);
    expect(perfil.cancelamentos).toEqual([
      expect.objectContaining({
        status: 'PENDENTE',
        motivo: null,
        solicitadaEm: '2026-10-01T12:00:00.000Z',
        decididaPor: null,
      }),
      expect.objectContaining({
        status: 'RECUSADA',
        motivo: 'Primeiro pedido',
        observacaoSede: 'Observação fictícia',
        decididaEm: '2026-09-02T12:00:00.000Z',
        decididaPor: { nome: 'Admin de Teste' },
      }),
    ]);
  });

  it('o perfil mostra se a conta de acesso existe e foi confirmada (RF07)', async () => {
    const { id } = await criar();
    const perfil = async () =>
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      (await comoAdmin(http().get(`/associados/${id}`)).expect(200))
        .body as AssociadoDetalhe;

    expect((await perfil()).conta).toBeNull();

    const email = `conta-${crypto.randomUUID()}@example.com`;
    await prisma.usuario.create({
      data: { email, nome: 'Conta', perfil: 'ASSOCIADO', associadoId: id },
    });
    expect((await perfil()).conta).toEqual({
      email,
      criadaEm: expect.any(String),
      confirmadaEm: null,
    });
  });

  describe('troca do e-mail, que também é o de acesso (RN34)', () => {
    async function comConta(email: string) {
      const { id } = await criar({ email });
      const conta = await prisma.usuario.create({
        data: {
          email: email.toLowerCase(),
          nome: 'Conta',
          perfil: 'ASSOCIADO',
          associadoId: id,
          senhaHash: 'x',
          emailConfirmadoEm: new Date(),
        },
      });
      return { id, conta };
    }
    const editar = (id: string, dados: Record<string, unknown>) =>
      comoAdmin(http().patch(`/associados/${id}`)).send(dados);

    beforeEach(() => {
      enviados.length = 0;
    });

    it('troca o login, invalida os links de senha e avisa os dois e-mails', async () => {
      const antigo = `antigo-${crypto.randomUUID()}@example.com`;
      const novo = `novo-${crypto.randomUUID()}@example.com`;
      const { id, conta } = await comConta(antigo);
      const link = await prisma.tokenUsuario.create({
        data: {
          usuarioId: conta.id,
          tipo: 'RECUPERACAO_SENHA',
          tokenHash: crypto.randomUUID(),
          expiraEm: new Date(Date.now() + 60_000),
        },
      });

      await editar(id, { email: novo.toUpperCase() }).expect(200);

      const depois = await prisma.usuario.findUniqueOrThrow({
        where: { id: conta.id },
      });
      expect(depois.email).toBe(novo);
      const linkDepois = await prisma.tokenUsuario.findUniqueOrThrow({
        where: { id: link.id },
      });
      expect(linkDepois.usadoEm).not.toBeNull();
      expect(enviados.map((mensagem) => mensagem.to).sort()).toEqual(
        [antigo, novo].sort(),
      );
      expect(await logsDo(id)).toContainEqual(
        expect.objectContaining({
          acao: 'CONTA_EMAIL_ALTERADO',
          entidade: 'Usuario',
          entidadeId: conta.id,
          valorAnterior: { email: antigo },
          valorNovo: { email: novo },
        }),
      );
    });

    it('recusa o e-mail que já é de outra conta (409, campo e-mail)', async () => {
      const ocupado = `ocupado-${crypto.randomUUID()}@example.com`;
      await comConta(ocupado);
      const { id, conta } = await comConta(
        `meu-${crypto.randomUUID()}@example.com`,
      );

      const resposta = await editar(id, { email: ocupado }).expect(409);
      expect(resposta.body).toMatchObject({ campo: 'email' });
      expect(
        (await prisma.usuario.findUniqueOrThrow({ where: { id: conta.id } }))
          .email,
      ).toBe(conta.email);
      expect(enviados).toHaveLength(0);
    });

    it('não deixa o associado com conta sem e-mail (400, campo e-mail)', async () => {
      const { id } = await comConta(
        `com-conta-${crypto.randomUUID()}@example.com`,
      );

      const resposta = await editar(id, { email: '' }).expect(400);
      expect(resposta.body).toMatchObject({ campo: 'email' });
    });

    it('sem conta, troca só o cadastro e não manda aviso', async () => {
      const { id } = await criar({ email: 'sem-conta@example.com' });

      await editar(id, { email: 'outro-sem-conta@example.com' }).expect(200);
      await editar(id, { email: '' }).expect(200);
      expect(enviados).toHaveLength(0);
    });
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
    // Interromper a cobrança tem rota própria, com motivo e aviso (RN25).
    await comoAdmin(http().patch(`/associados/${id}`))
      .send({ contribuicaoAtiva: false })
      .expect(400);
    await comoAdmin(http().post(`/associados/${id}/interromper-cobranca`))
      .send({ motivo: 'Teste' })
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

  describe('acesso manual (RF09, RN11)', () => {
    const definir = (id: string, dados: Record<string, unknown>) =>
      comoAdmin(http().put(`/associados/${id}/acesso`)).send(dados);

    it('bloqueia, libera e volta ao automático, com o motivo só no log', async () => {
      const { id } = await criar();

      const bloqueado = await definir(id, {
        acessoManual: 'BLOQUEADO',
        motivo: ' Motivo fictício de bloqueio ',
      }).expect(200);
      expect(bloqueado.body).toMatchObject({ acessoManual: 'BLOQUEADO' });
      expect(bloqueado.body).not.toHaveProperty('motivo');
      const liberado = await definir(id, {
        acessoManual: 'LIBERADO',
        motivo: 'Motivo fictício de liberação',
      }).expect(200);
      // A liberação vale 7 dias (RN11).
      const dias =
        (new Date(liberado.body.acessoManualAte).getTime() - Date.now()) /
        (24 * 60 * 60 * 1000);
      expect(dias).toBeGreaterThan(6.9);
      expect(dias).toBeLessThanOrEqual(7);
      const automatico = await definir(id, {
        acessoManual: null,
        motivo: 'Volta a seguir o pagamento',
      }).expect(200);
      expect(automatico.body).toMatchObject({ acessoManual: null });
      // Já está no automático: nada muda e nada vai para o log.
      await definir(id, { acessoManual: null, motivo: 'De novo' }).expect(200);

      const logs = (await logsDo(id)).slice(1);
      expect(logs).toEqual([
        expect.objectContaining({
          usuarioId: adminId,
          acao: 'ACESSO_BLOQUEADO',
          valorAnterior: { acessoManual: null },
          valorNovo: {
            acessoManual: 'BLOQUEADO',
            motivo: 'Motivo fictício de bloqueio',
          },
        }),
        expect.objectContaining({
          acao: 'ACESSO_LIBERADO',
          valorAnterior: { acessoManual: 'BLOQUEADO', acessoManualAte: null },
          valorNovo: {
            acessoManual: 'LIBERADO',
            acessoManualAte: liberado.body.acessoManualAte,
            motivo: 'Motivo fictício de liberação',
          },
        }),
        expect.objectContaining({
          acao: 'ACESSO_AUTOMATICO',
          valorAnterior: {
            acessoManual: 'LIBERADO',
            acessoManualAte: liberado.body.acessoManualAte,
          },
          valorNovo: {
            acessoManual: null,
            acessoManualAte: null,
            motivo: 'Volta a seguir o pagamento',
          },
        }),
      ]);
    });

    it.each([
      ['sem motivo', { acessoManual: 'BLOQUEADO' }],
      ['com motivo vazio', { acessoManual: 'BLOQUEADO', motivo: '  ' }],
      ['sem a decisão', { motivo: 'Motivo fictício' }],
      ['com decisão desconhecida', { acessoManual: 'OUTRO', motivo: 'x' }],
    ])('recusa %s (400)', async (_caso, dados) => {
      const { id } = await criar();
      await definir(id, dados).expect(400);
      expect(await logsDo(id)).toHaveLength(1);
    });

    it('recusa associado inexistente (404) e token de associado (403)', async () => {
      await definir(crypto.randomUUID(), {
        acessoManual: 'BLOQUEADO',
        motivo: 'Motivo fictício',
      }).expect(404);
      const { id } = await criar();
      await http()
        .put(`/associados/${id}/acesso`)
        .set('Authorization', `Bearer ${tokenAssociado}`)
        .send({ acessoManual: 'BLOQUEADO', motivo: 'Motivo fictício' })
        .expect(403);
      expect(await logsDo(id)).toHaveLength(1);
    });
  });

  describe('minha conta, na área do associado (RN11, RN22)', () => {
    async function contaDe(associadoId: string) {
      const usuario = await prisma.usuario.create({
        data: {
          email: `minha-conta-${crypto.randomUUID()}@example.com`,
          nome: 'Conta',
          perfil: 'ASSOCIADO',
          associadoId,
        },
      });
      const token = await app.get(JwtService).signAsync(
        { perfil: 'ASSOCIADO' },
        {
          secret: process.env.JWT_SECRET,
          subject: usuario.id,
          expiresIn: 300,
        },
      );
      return () =>
        http().get('/minha-conta').set('Authorization', `Bearer ${token}`);
    }

    it('mostra a situação e o aviso enquanto a liberação vale', async () => {
      const { id } = await criar({ contribuicaoAtiva: true });
      const minhaConta = await contaDe(id);

      await minhaConta().expect(200, {
        nome: 'Farmácia Teste Ltda',
        situacao: 'Inadimplente',
        acessoLiberadoAte: null,
        recebeBoletoMensal: true,
      });

      const liberado = await comoAdmin(http().put(`/associados/${id}/acesso`))
        .send({ acessoManual: 'LIBERADO', motivo: 'Motivo fictício' })
        .expect(200);
      expect((await minhaConta().expect(200)).body.acessoLiberadoAte).toBe(
        liberado.body.acessoManualAte,
      );

      // Liberação vencida: o aviso some (a data é conferida na hora).
      await prisma.associado.update({
        where: { id },
        data: { acessoManualAte: new Date(Date.now() - 1000) },
      });
      expect(
        (await minhaConta().expect(200)).body.acessoLiberadoAte,
      ).toBeNull();
    });

    it('recusa sem token (401) e a sede (403)', async () => {
      await http().get('/minha-conta').expect(401);
      await comoAdmin(http().get('/minha-conta')).expect(403);
    });
  });

  describe('lista (RF06)', () => {
    // Texto único por execução, porque o banco de teste guarda os dados.
    const marca = `Lista ${crypto.randomUUID().slice(0, 8)}`;
    const ids: Record<string, string> = {};
    const cnpjs: Record<string, string> = {};

    async function listar(query: Record<string, string | number> = {}) {
      const resposta = await comoAdmin(http().get('/associados'))
        .query({ busca: marca, ...query })
        .expect(200);
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      return resposta.body as ListaAssociados;
    }

    beforeAll(async () => {
      const criarDireto = async (
        letra: string,
        dados: Record<string, unknown> = {},
      ) => {
        cnpjs[letra] = cnpjNovo();
        const associado = await prisma.associado.create({
          data: {
            cnpj: cnpjs[letra],
            razaoSocial: `Farmácia ${marca} ${letra}`,
            ...dados,
          },
        });
        ids[letra] = associado.id;
      };
      await criarDireto('A', {
        situacao: 'ADIMPLENTE',
        contribuicaoAtiva: true,
      });
      // Em atraso, com contribuição ativa: "Inadimplente" (RN22).
      await criarDireto('B', { contribuicaoAtiva: true });
      await criarDireto('C', {
        situacao: 'ADIMPLENTE',
        contribuicaoAtiva: true,
      });
      await prisma.solicitacaoCancelamento.create({
        data: { associadoId: ids.C },
      });
      await criarDireto('D', { inativadoEm: new Date() });
      // Achado pelo nome fantasia, não pela razão social.
      await criarDireto('E', {
        razaoSocial: 'Outra Razão Social',
        nomeFantasia: `Drogaria ${marca}`,
      });
    });

    it('recusa sem token (401) e com token de associado (403)', async () => {
      await http().get('/associados').expect(401);
      await http()
        .get('/associados')
        .set('Authorization', `Bearer ${tokenAssociado}`)
        .expect(403);
    });

    it('busca por razão social ou nome fantasia, sem os inativados', async () => {
      const lista = await listar();
      expect(lista).toMatchObject({ total: 4, pagina: 1, porPagina: 20 });
      expect(idsDe(lista)).toEqual([ids.A, ids.B, ids.C, ids.E]);
      expect(lista.itens[2]).toMatchObject({
        cnpj: cnpjs.C,
        situacao: 'ADIMPLENTE',
        contribuicaoAtiva: true,
        cancelamentoSolicitado: true,
        acessoManual: null,
        inativadoEm: null,
      });
      expect(lista.itens[0].cancelamentoSolicitado).toBe(false);
    });

    it('não diferencia maiúsculas de minúsculas', async () => {
      const lista = await listar({ busca: marca.toUpperCase() });
      expect(lista.total).toBe(4);
    });

    it('busca pelo CNPJ com ou sem pontuação', async () => {
      const cnpj = cnpjs.A;
      const formatado = `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`;
      expect(idsDe(await listar({ busca: formatado }))).toEqual([ids.A]);
      expect(idsDe(await listar({ busca: cnpj }))).toEqual([ids.A]);
    });

    it.each([
      ['ADIMPLENTE', ['A', 'C']],
      ['INADIMPLENTE', ['B']],
      ['SEM_CONTRIBUICAO', ['E']],
      ['CANCELAMENTO_SOLICITADO', ['C']],
    ])('filtra pelo status %s', async (status, letras) => {
      const lista = await listar({ status });
      expect(idsDe(lista)).toEqual(letras.map((letra) => ids[letra]));
    });

    it('o filtro de status não apaga o de "Recebe boleto mensal"', async () => {
      const lista = await listar({
        status: 'SEM_CONTRIBUICAO',
        contribuicaoAtiva: 'true',
      });
      expect(lista.total).toBe(0);
    });

    it.each([
      ['true', ['A', 'B', 'C']],
      ['false', ['E']],
    ])('filtra por "Recebe boleto mensal" = %s', async (valor, letras) => {
      const lista = await listar({ contribuicaoAtiva: valor });
      expect(idsDe(lista)).toEqual(letras.map((letra) => ids[letra]));
    });

    it('mostra os inativados quando pedido', async () => {
      const lista = await listar({ incluirInativos: 'true' });
      expect(idsDe(lista)).toEqual([ids.A, ids.B, ids.C, ids.D, ids.E]);
    });

    it('divide em páginas de 20', async () => {
      const outraMarca = `Paginas ${crypto.randomUUID().slice(0, 8)}`;
      for (let i = 0; i < 21; i++) {
        await prisma.associado.create({
          data: {
            cnpj: cnpjNovo(),
            razaoSocial: `Farmácia ${outraMarca} ${String(i).padStart(2, '0')}`,
          },
        });
      }
      const pagina1 = await listar({ busca: outraMarca });
      const pagina2 = await listar({ busca: outraMarca, pagina: 2 });
      expect(pagina1).toMatchObject({ total: 21, pagina: 1 });
      expect(pagina1.itens).toHaveLength(20);
      expect(pagina2).toMatchObject({ total: 21, pagina: 2 });
      expect(pagina2.itens).toHaveLength(1);
    });

    it.each([
      ['status desconhecido', { status: 'OUTRO' }],
      ['página zero', { pagina: 0 }],
      ['filtro desconhecido', { municipio: 'Cuiabá' }],
    ])('recusa %s (400)', async (_motivo, query) => {
      await comoAdmin(http().get('/associados')).query(query).expect(400);
    });
  });
});
