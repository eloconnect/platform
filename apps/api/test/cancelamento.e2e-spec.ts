// Cancelamento do boleto mensal (RN18): o pedido do associado (US26: RF26), a
// decisão da sede e a confirmação em 15 dias (US27: RF27). Roda no banco de
// teste (preparar-banco.mjs).
import 'dotenv/config';
import { formatarDia, type AssociadoDetalhe } from '@eloconnect/shared';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { CancelamentosService } from '../src/cancelamentos/cancelamentos.service.js';
import { respostaAte } from '../src/cancelamentos/prazo.js';
import { EmailService, type EmailMessage } from '../src/email/email.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

process.env.JWT_SECRET ??= 'segredo-so-para-teste-com-mais-de-32-caracteres';

/** E-mails "enviados" pela API, no lugar do SMTP. */
const enviados: EmailMessage[] = [];
const send = (mensagem: EmailMessage) => {
  enviados.push(mensagem);
  return Promise.resolve();
};

/** Os avisos saem depois da resposta: espera o e-mail chegar. */
async function emailPara(endereco: string): Promise<EmailMessage> {
  for (let tentativa = 0; tentativa < 40; tentativa++) {
    const mensagem = enviados.find(({ to }) => to === endereco);
    if (mensagem) return mensagem;
    await new Promise((pronto) => setTimeout(pronto, 50));
  }
  throw new Error(`Nenhum e-mail para ${endereco}.`);
}

describe('Pedido de cancelamento (e2e)', () => {
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

  /** Associado com conta e token; por padrão, recebe o boleto mensal. */
  async function criarAssociado(contribuicaoAtiva = true) {
    const marcador = crypto.randomUUID();
    const associado = await prisma.associado.create({
      data: {
        cnpj: marcador.replace(/\D/g, '').padEnd(14, '0').slice(0, 14),
        razaoSocial: 'Farmácia do Cancelamento Ltda',
        email: `cancelamento-${marcador}@example.com`,
        situacao: 'ADIMPLENTE',
        contribuicaoAtiva,
      },
    });
    criados.push(associado.id);
    const usuario = await prisma.usuario.create({
      data: {
        email: `cancelamento-conta-${marcador}@example.com`,
        nome: 'Responsável',
        perfil: 'ASSOCIADO',
        senhaHash: 'x',
        associadoId: associado.id,
      },
    });
    const token = await assinar('ASSOCIADO', usuario.id);
    return {
      associado,
      /** Pede o cancelamento e devolve o id do pedido. */
      pedido: async () => {
        await http()
          .post('/associado/cancelamento')
          .set('Authorization', `Bearer ${token}`)
          .expect(201);
        const { id } = await prisma.solicitacaoCancelamento.findFirstOrThrow({
          where: { associadoId: associado.id, status: 'PENDENTE' },
        });
        return id;
      },
      pedir: () =>
        http()
          .post('/associado/cancelamento')
          .set('Authorization', `Bearer ${token}`),
      minhaConta: () =>
        http().get('/minha-conta').set('Authorization', `Bearer ${token}`),
    };
  }

  /** Usuário da sede, com token. */
  async function criarUsuarioSede(perfil = 'ADMIN', ativo = true) {
    const marcador = crypto.randomUUID();
    const usuario = await prisma.usuario.create({
      data: {
        email: `cancelamento-sede-${marcador}@example.com`,
        nome: `Sede ${marcador.slice(0, 8)}`,
        perfil: perfil === 'ADMIN' ? 'ADMIN' : 'ADMIN_BASICO',
        senhaHash: 'x',
        ativo,
      },
    });
    return { usuario, token: await assinar(perfil, usuario.id) };
  }

  const decidir = (pedidoId: string, token: string, dados: object) =>
    http()
      .post(`/cancelamentos/${pedidoId}/decisao`)
      .set('Authorization', `Bearer ${token}`)
      .send(dados);

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
  });

  afterAll(async () => {
    // Os associados deste teste não entram nos lotes dos outros testes.
    await prisma.associado.updateMany({
      where: { id: { in: criados } },
      data: { contribuicaoAtiva: false },
    });
    await app.close();
  });

  it('recusa sem token (401) e para a sede (403)', async () => {
    const semToken = await http().post('/associado/cancelamento');
    const daSede = await http()
      .post('/associado/cancelamento')
      .set(
        'Authorization',
        `Bearer ${await assinar('ADMIN', crypto.randomUUID())}`,
      );

    expect([semToken.status, daSede.status]).toEqual([401, 403]);
  });

  it('o pedido fica pendente, e a sede vê o cancelamento solicitado', async () => {
    const { associado, pedir, minhaConta } = await criarAssociado();

    const { body } = await pedir().expect(201);

    const pedidoEm = (body as { pedidoEm: string }).pedidoEm;
    expect(new Date(pedidoEm).getTime()).toBeLessThanOrEqual(Date.now());
    expect((await minhaConta().expect(200)).body).toMatchObject({
      // Até a sede decidir, a farmácia continua recebendo o boleto.
      recebeBoletoMensal: true,
      cancelamentoPedidoEm: pedidoEm,
    });
    const perfil = await http()
      .get(`/associados/${associado.id}`)
      .set(
        'Authorization',
        `Bearer ${await assinar('ADMIN_BASICO', crypto.randomUUID())}`,
      )
      .expect(200);
    expect((perfil.body as AssociadoDetalhe).cancelamentos).toEqual([
      expect.objectContaining({
        status: 'PENDENTE',
        solicitadaEm: pedidoEm,
        decididaEm: null,
        decididaPor: null,
      }),
    ]);
  });

  it('não aceita um segundo pedido enquanto o primeiro espera a sede', async () => {
    const { associado, pedir } = await criarAssociado();
    await pedir().expect(201);

    const repetido = await pedir().expect(409);

    expect(repetido.body.message).toBe(
      'O pedido de cancelamento já foi enviado. A sede vai responder.',
    );
    expect(
      await prisma.solicitacaoCancelamento.count({
        where: { associadoId: associado.id },
      }),
    ).toBe(1);
  });

  it('dois pedidos ao mesmo tempo viram um só', async () => {
    const { associado, pedir } = await criarAssociado();

    const respostas = await Promise.all([pedir(), pedir()]);

    expect(respostas.map((r) => r.status).toSorted((a, b) => a - b)).toEqual([
      201, 409,
    ]);
    expect(
      await prisma.solicitacaoCancelamento.count({
        where: { associadoId: associado.id },
      }),
    ).toBe(1);
  });

  it('quem não recebe o boleto mensal não tem o que cancelar', async () => {
    const { associado, pedir, minhaConta } = await criarAssociado(false);

    const resposta = await pedir().expect(409);

    expect(resposta.body.message).toBe(
      'A farmácia não recebe o boleto mensal.',
    );
    expect((await minhaConta().expect(200)).body).toMatchObject({
      recebeBoletoMensal: false,
      cancelamentoPedidoEm: null,
    });
    expect(
      await prisma.solicitacaoCancelamento.count({
        where: { associadoId: associado.id },
      }),
    ).toBe(0);
  });

  it('avisa por e-mail cada chave mestre ativo, com o prazo e o perfil', async () => {
    const chaveMestre = await criarUsuarioSede();
    const inativo = await criarUsuarioSede('ADMIN', false);
    const basico = await criarUsuarioSede('ADMIN_BASICO');
    const { associado, pedir } = await criarAssociado();

    const { body } = await pedir().expect(201);

    const aviso = await emailPara(chaveMestre.usuario.email);
    expect(aviso.subject).toBe(
      'Pedido de cancelamento do boleto mensal - Elo Connect',
    );
    expect(aviso.text).toContain('Farmácia do Cancelamento Ltda (CNPJ ');
    expect(aviso.text).toContain(
      `até ${formatarDia(respostaAte(new Date((body as { pedidoEm: string }).pedidoEm)))}.`,
    );
    expect(aviso.text).toContain(`/admin/associados/${associado.id}`);
    const destinos = enviados.map(({ to }) => to);
    expect(destinos).not.toContain(inativo.usuario.email);
    expect(destinos).not.toContain(basico.usuario.email);
  });

  describe('decisão da sede (US27)', () => {
    it('só o chave mestre decide', async () => {
      const { pedido } = await criarAssociado();
      const id = await pedido();
      const basico = await criarUsuarioSede('ADMIN_BASICO');

      const semToken = await http()
        .post(`/cancelamentos/${id}/decisao`)
        .send({ decisao: 'APROVADA' });
      const doBasico = await decidir(id, basico.token, { decisao: 'APROVADA' });

      expect([semToken.status, doBasico.status]).toEqual([401, 403]);
      expect(
        (
          await prisma.solicitacaoCancelamento.findUniqueOrThrow({
            where: { id },
          })
        ).status,
      ).toBe('PENDENTE');
    });

    it('aprovar encerra o boleto mensal, grava no log e avisa o associado', async () => {
      const { associado, pedido, minhaConta } = await criarAssociado();
      const id = await pedido();
      const chaveMestre = await criarUsuarioSede();

      const { body } = await decidir(id, chaveMestre.token, {
        decisao: 'APROVADA',
      }).expect(200);

      const perfil = body as AssociadoDetalhe;
      expect(perfil.contribuicaoAtiva).toBe(false);
      expect(perfil.cancelamentos).toEqual([
        expect.objectContaining({
          id,
          status: 'APROVADA',
          decididaPor: { nome: chaveMestre.usuario.nome },
          observacaoSede: null,
        }),
      ]);
      // Quem estava em dia mantém o acesso por 30 dias, como na interrupção.
      expect(perfil.interrupcaoCobranca?.interrompidaEm).toBe(
        perfil.cancelamentos[0].decididaEm,
      );
      expect((await minhaConta().expect(200)).body).toMatchObject({
        recebeBoletoMensal: false,
        cancelamentoPedidoEm: null,
      });
      const log = await prisma.logAuditoria.findFirstOrThrow({
        where: { entidadeId: id },
      });
      expect(log).toMatchObject({
        usuarioId: chaveMestre.usuario.id,
        acao: 'CANCELAMENTO_APROVADO',
        associadoId: associado.id,
        valorAnterior: { status: 'PENDENTE', contribuicaoAtiva: true },
        valorNovo: { status: 'APROVADA', contribuicaoAtiva: false },
      });
      const aviso = await emailPara(associado.email ?? '');
      expect(aviso.subject).toBe('O cancelamento foi confirmado - Elo Connect');
      expect(aviso.text).toContain(
        `O seu acesso a benefícios e suporte continua até ${formatarDia(perfil.interrupcaoCobranca?.acessoAte ?? '')}.`,
      );
    });

    it('recusar mantém o boleto mensal e guarda a observação só para a sede', async () => {
      const { associado, pedido } = await criarAssociado();
      const id = await pedido();
      const chaveMestre = await criarUsuarioSede();

      const { body } = await decidir(id, chaveMestre.token, {
        decisao: 'RECUSADA',
        observacao: '  A farmácia desistiu.  ',
      }).expect(200);

      const perfil = body as AssociadoDetalhe;
      expect(perfil.contribuicaoAtiva).toBe(true);
      expect(perfil.cancelamentos[0]).toMatchObject({
        status: 'RECUSADA',
        observacaoSede: 'A farmácia desistiu.',
      });
      const log = await prisma.logAuditoria.findFirstOrThrow({
        where: { entidadeId: id },
      });
      expect(log).toMatchObject({
        acao: 'CANCELAMENTO_RECUSADO',
        valorAnterior: { status: 'PENDENTE' },
        valorNovo: { status: 'RECUSADA', observacao: 'A farmácia desistiu.' },
      });
      const aviso = await emailPara(associado.email ?? '');
      expect(aviso.subject).toBe(
        'O pedido de cancelamento foi recusado - Elo Connect',
      );
      expect(aviso.text).not.toContain('A farmácia desistiu.');
    });

    it('não decide de novo, nem pedido que não existe, nem decisão inválida', async () => {
      const { pedido } = await criarAssociado();
      const id = await pedido();
      const { token } = await criarUsuarioSede();
      await decidir(id, token, { decisao: 'RECUSADA' }).expect(200);

      const repetida = await decidir(id, token, { decisao: 'APROVADA' });

      expect(repetida.status).toBe(409);
      expect(repetida.body.message).toBe(
        'Este pedido de cancelamento já foi decidido.',
      );
      await decidir(crypto.randomUUID(), token, { decisao: 'APROVADA' }).expect(
        404,
      );
      await decidir(id, token, { decisao: 'TALVEZ' }).expect(400);
    });

    it('duas decisões ao mesmo tempo viram uma só', async () => {
      const { pedido } = await criarAssociado();
      const id = await pedido();
      const { token } = await criarUsuarioSede();

      const respostas = await Promise.all([
        decidir(id, token, { decisao: 'APROVADA' }),
        decidir(id, token, { decisao: 'RECUSADA' }),
      ]);

      expect(respostas.map((r) => r.status).toSorted((a, b) => a - b)).toEqual([
        200, 409,
      ]);
      expect(
        await prisma.logAuditoria.count({ where: { entidadeId: id } }),
      ).toBe(1);
    });
  });

  it('sem resposta, o pedido é confirmado no dia seguinte ao fim do prazo (RN18)', async () => {
    const cancelamentos = app.get(CancelamentosService);
    // Pedidos de 2000, que nenhum outro teste usa. O de 4 de janeiro pode
    // ser recusado até o dia 19; o de 5 de janeiro, até o dia 20.
    const dia4 = await criarAssociado();
    const dia5 = await criarAssociado();
    const pedido = (associadoId: string, solicitadaEm: string) =>
      prisma.solicitacaoCancelamento.create({
        data: { associadoId, solicitadaEm: new Date(solicitadaEm) },
      });
    // 4 e 5 de janeiro, 12h em Mato Grosso.
    const doDia4 = await pedido(dia4.associado.id, '2000-01-04T16:00:00Z');
    const doDia5 = await pedido(dia5.associado.id, '2000-01-05T16:00:00Z');

    // 20 de janeiro, 7h em Mato Grosso, a hora do cron.
    const dia20 = await cancelamentos.confirmarSemResposta(
      new Date('2000-01-20T11:00:00Z'),
    );

    expect(dia20).toEqual({ dia: '2000-01-20', confirmados: 1 });
    const situacao = async (id: string) =>
      (
        await prisma.solicitacaoCancelamento.findUniqueOrThrow({
          where: { id },
        })
      ).status;
    expect(await situacao(doDia4.id)).toBe('CONFIRMADA_AUTOMATICAMENTE');
    expect(await situacao(doDia5.id)).toBe('PENDENTE');
    const confirmado = await prisma.associado.findUniqueOrThrow({
      where: { id: dia4.associado.id },
    });
    expect(confirmado.contribuicaoAtiva).toBe(false);
    expect(confirmado.cobrancaInterrompidaEm).toEqual(
      new Date('2000-01-20T11:00:00Z'),
    );
    // O job não grava no log: nenhuma pessoa da sede decidiu.
    expect(
      await prisma.logAuditoria.count({ where: { entidadeId: doDia4.id } }),
    ).toBe(0);
    expect((await emailPara(dia4.associado.email ?? '')).subject).toBe(
      'O cancelamento foi confirmado - Elo Connect',
    );

    await expect(
      cancelamentos.confirmarSemResposta(new Date('2000-01-21T11:00:00Z')),
    ).resolves.toEqual({ dia: '2000-01-21', confirmados: 1 });
    expect(await situacao(doDia5.id)).toBe('CONFIRMADA_AUTOMATICAMENTE');
  });
});
