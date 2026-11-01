// Edição do boleto do mês seguinte pela sede (US11: RF11, RN04). Roda no banco
// de teste (preparar-banco.mjs). Os testes pela API usam o mês seguinte de
// verdade; os que dependem do valor da contribuição rodam numa transação
// desfeita no fim, com datas em 2099, porque outros testes mudam o valor ao
// mesmo tempo.
import 'dotenv/config';
import {
  cnpjValido,
  competenciaDoNovoValor,
  formatarReais,
  type AssociadoDetalhe,
  type ProximoBoleto,
} from '@eloconnect/shared';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { AuditoriaService } from '../src/auditoria/auditoria.service.js';
import { EdicaoBoletoService } from '../src/cobranca/edicao-boleto.service.js';
import { EmailService, type EmailMessage } from '../src/email/email.service.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

process.env.JWT_SECRET ??= 'segredo-so-para-teste-com-mais-de-32-caracteres';

type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

class Desfazer extends Error {}

/** CNPJ numérico válido e diferente a cada chamada. */
function cnpjNovo(): string {
  const base = String(Math.floor(Math.random() * 1e12)).padStart(12, '0');
  for (let dv = 0; dv < 100; dv++) {
    const cnpj = base + String(dv).padStart(2, '0');
    if (cnpjValido(cnpj)) return cnpj;
  }
  throw new Error('Não achei os dígitos verificadores.');
}

const caminho = (id: string) => `/associados/${id}/proximo-boleto`;

describe('Próximo boleto (e2e)', () => {
  // E-mails "enviados" pela API, no lugar do SMTP.
  const enviados: EmailMessage[] = [];
  const send = (mensagem: EmailMessage) => {
    enviados.push(mensagem);
    return Promise.resolve();
  };
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwt: JwtService;
  let adminId: string;
  let tokenAdmin: string;

  const http = () => request(app.getHttpServer());
  const assinar = (perfil: string, sub: string) =>
    jwt.signAsync(
      { perfil },
      { secret: process.env.JWT_SECRET, subject: sub, expiresIn: 300 },
    );

  function criarAssociado(dados: {
    contribuicaoAtiva: boolean;
    inativadoEm?: Date;
  }) {
    const marcador = crypto.randomUUID();
    return prisma.associado.create({
      data: {
        cnpj: cnpjNovo(),
        razaoSocial: `Farmácia ${marcador} Ltda`,
        email: `boleto-${marcador}@example.com`,
        ...dados,
      },
    });
  }

  /**
   * Roda o teste numa transação desfeita no fim, com o serviço usando essa
   * mesma transação no lugar do banco.
   */
  async function desfazendoNoFim(
    teste: (tx: Tx, servico: EdicaoBoletoService) => Promise<void>,
  ) {
    await prisma
      .$transaction(
        async (tx) => {
          const banco = new Proxy(tx, {
            get: (alvo, nome) =>
              nome === '$transaction'
                ? (fn: (t: Tx) => unknown) => fn(alvo)
                : Reflect.get(alvo, nome),
          }) as unknown as PrismaService;
          await teste(
            tx,
            new EdicaoBoletoService(banco, new AuditoriaService(), {
              send,
            } as unknown as EmailService),
          );
          throw new Desfazer();
        },
        { timeout: 60_000 },
      )
      .catch((erro: unknown) => {
        if (!(erro instanceof Desfazer)) throw erro;
      });
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
        email: `proximo-boleto-${crypto.randomUUID()}@example.com`,
        nome: 'Admin do Boleto',
        perfil: 'ADMIN',
        senhaHash: 'x',
      },
    });
    adminId = admin.id;
    tokenAdmin = await assinar('ADMIN', admin.id);
    // Sem nenhum valor, não há boleto para editar. O valor de 2000 nunca é o
    // atual quando outro teste já cadastrou um.
    if (!(await prisma.valorContribuicao.findFirst())) {
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

  afterAll(() => app.close());

  it('recusa sem token (401) e para o perfil básico e o associado (403)', async () => {
    const { id } = await criarAssociado({ contribuicaoAtiva: true });
    const basico = await assinar('ADMIN_BASICO', crypto.randomUUID());
    const associado = await assinar('ASSOCIADO', crypto.randomUUID());

    await http().put(caminho(id)).send({ valor: '42.42' }).expect(401);
    for (const token of [basico, associado]) {
      await http()
        .put(caminho(id))
        .set('Authorization', `Bearer ${token}`)
        .send({ valor: '42.42' })
        .expect(403);
      await http()
        .delete(caminho(id))
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    }
    expect(
      await prisma.edicaoBoleto.count({ where: { associadoId: id } }),
    ).toBe(0);
  });

  it('o perfil mostra o próximo boleto só de quem recebe o boleto mensal', async () => {
    const recebe = await criarAssociado({ contribuicaoAtiva: true });
    const naoRecebe = await criarAssociado({ contribuicaoAtiva: false });
    const inativado = await criarAssociado({
      contribuicaoAtiva: true,
      inativadoEm: new Date(),
    });
    const basico = await assinar('ADMIN_BASICO', crypto.randomUUID());
    const perfil = async (id: string) => {
      const resposta = await http()
        .get(`/associados/${id}`)
        .set('Authorization', `Bearer ${basico}`)
        .expect(200);
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      return (resposta.body as AssociadoDetalhe).proximoBoleto;
    };

    expect(await perfil(recebe.id)).toEqual({
      competencia: competenciaDoNovoValor(new Date()),
      valorNormal: expect.stringMatching(/^\d+\.\d{2}$/),
      valorEditado: null,
    });
    expect(await perfil(naoRecebe.id)).toBeNull();
    expect(await perfil(inativado.id)).toBeNull();
  });

  it('muda o valor, grava no log e avisa o associado por e-mail na hora', async () => {
    const associado = await criarAssociado({ contribuicaoAtiva: true });
    const competencia = competenciaDoNovoValor(new Date());
    const mes = `${competencia.ano}-${String(competencia.mes).padStart(2, '0')}`;
    const editar = async (valor: string) => {
      const resposta = await http()
        .put(caminho(associado.id))
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ valor })
        .expect(200);
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      return resposta.body as ProximoBoleto;
    };
    enviados.length = 0;

    const primeira = await editar('42.42');
    expect(primeira).toEqual({
      competencia,
      valorNormal: expect.stringMatching(/^\d+\.\d{2}$/),
      valorEditado: '42.42',
    });
    // Trocar a edição já feita.
    const segunda = await editar('43.00');
    expect(segunda.valorEditado).toBe('43.00');

    const edicao = await prisma.edicaoBoleto.findUniqueOrThrow({
      where: {
        associadoId_competencia: {
          associadoId: associado.id,
          competencia: new Date(Date.UTC(competencia.ano, competencia.mes - 1)),
        },
      },
    });
    expect(edicao.valor.toFixed(2)).toBe('43.00');

    const logs = await prisma.logAuditoria.findMany({
      where: { associadoId: associado.id },
      orderBy: { ocorridoEm: 'asc' },
    });
    expect(logs).toMatchObject([
      {
        usuarioId: adminId,
        acao: 'BOLETO_VALOR_EDITADO',
        entidade: 'EdicaoBoleto',
        entidadeId: edicao.id,
        valorAnterior: { valor: primeira.valorNormal },
        valorNovo: { competencia: mes, valor: '42.42' },
      },
      {
        acao: 'BOLETO_VALOR_EDITADO',
        valorAnterior: { valor: '42.42' },
        valorNovo: { competencia: mes, valor: '43.00' },
      },
    ]);

    const meus = enviados.filter(({ to }) => to === associado.email);
    expect(meus).toHaveLength(2);
    expect(meus[1].subject).toBe(
      'O valor do seu próximo boleto vai mudar - Elo Connect',
    );
    expect(meus[1].text).toContain(`Olá, ${associado.razaoSocial}.`);
    expect(meus[1].text).toContain('A sede do sindicato mudou o valor');
    expect(meus[1].text).toContain(
      `Valor anterior: ${formatarReais('42.42')}.`,
    );
    expect(meus[1].text).toContain(`Novo valor: ${formatarReais('43.00')}.`);
  });

  it('volta ao valor normal, grava no log e avisa o associado', async () => {
    const associado = await criarAssociado({ contribuicaoAtiva: true });
    const desfazer = () =>
      http()
        .delete(caminho(associado.id))
        .set('Authorization', `Bearer ${tokenAdmin}`);
    await http()
      .put(caminho(associado.id))
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ valor: '42.42' })
      .expect(200);
    enviados.length = 0;

    const resposta = await desfazer().expect(200);
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const proximo = resposta.body as ProximoBoleto;
    expect(proximo.valorEditado).toBeNull();
    expect(
      await prisma.edicaoBoleto.count({ where: { associadoId: associado.id } }),
    ).toBe(0);

    const log = await prisma.logAuditoria.findFirstOrThrow({
      where: { associadoId: associado.id, acao: 'BOLETO_VALOR_NORMAL' },
    });
    expect(log).toMatchObject({
      usuarioId: adminId,
      valorAnterior: { valor: '42.42' },
      valorNovo: { valor: proximo.valorNormal },
    });
    const [aviso] = enviados.filter(({ to }) => to === associado.email);
    expect(aviso.text).toContain('volta ao valor normal da contribuição');

    // Sem edição, não há o que desfazer.
    await desfazer().expect(400);
  });

  it('recusa valor inválido, repetido ou de quem não recebe o boleto mensal', async () => {
    const associado = await criarAssociado({ contribuicaoAtiva: true });
    const editar = (id: string, valor: string) =>
      http()
        .put(caminho(id))
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ valor });

    for (const valor of ['42', '42,00', '-1.00', '1000000.00', '']) {
      await editar(associado.id, valor).expect(400);
    }
    const zero = await editar(associado.id, '0.00').expect(400);
    expect(zero.body).toMatchObject({ campo: 'valor' });

    await editar(associado.id, '42.42').expect(200);
    const repetido = await editar(associado.id, '042.42').expect(400);
    expect(repetido.body).toMatchObject({
      message: 'O boleto já está com este valor.',
      campo: 'valor',
    });

    const naoRecebe = await criarAssociado({ contribuicaoAtiva: false });
    const inativado = await criarAssociado({
      contribuicaoAtiva: true,
      inativadoEm: new Date(),
    });
    for (const { id } of [naoRecebe, inativado]) {
      const resposta = await editar(id, '42.42').expect(400);
      expect(resposta.body).toMatchObject({
        message: 'Este associado não recebe o boleto mensal.',
      });
    }
    await editar(crypto.randomUUID(), '42.42').expect(404);
    await editar('nao-e-uuid', '42.42').expect(400);
  });

  it('a edição feita num mês vale para o boleto do mês seguinte, em Mato Grosso', async () => {
    await desfazendoNoFim(async (tx, servico) => {
      const associado = await tx.associado.create({
        data: {
          cnpj: cnpjNovo(),
          razaoSocial: 'Farmácia Teste Ltda',
          contribuicaoAtiva: true,
        },
      });
      await tx.valorContribuicao.create({
        data: {
          valorMensal: '100.00',
          valorAnual: '960.00',
          alteradoPorId: adminId,
          criadoEm: new Date('2099-05-10T12:00:00Z'),
        },
      });

      // 31 de maio, 23h em Mato Grosso: ainda é maio, então vale para junho.
      await expect(
        servico.editar(
          adminId,
          associado.id,
          '80.00',
          new Date('2099-06-01T03:00:00Z'),
        ),
      ).resolves.toEqual({
        competencia: { ano: 2099, mes: 6 },
        valorNormal: '100.00',
        valorEditado: '80.00',
      });
      // 1º de junho, 1h em Mato Grosso: a edição de junho não pode mais mudar,
      // e a próxima vale para julho.
      const junho = new Date('2099-06-01T05:00:00Z');
      await expect(
        servico.proximoBoleto(associado, junho),
      ).resolves.toMatchObject({
        competencia: { ano: 2099, mes: 7 },
        valorEditado: null,
      });
      await expect(
        servico.voltarAoNormal(adminId, associado.id, junho),
      ).rejects.toThrow('O boleto já está com o valor normal da contribuição.');
    });
  });

  it('recusa o valor que o boleto já tem e avisa quando não há valor cadastrado', async () => {
    await desfazendoNoFim(async (tx, servico) => {
      const associado = await tx.associado.create({
        data: {
          cnpj: cnpjNovo(),
          razaoSocial: 'Farmácia Teste Ltda',
          contribuicaoAtiva: true,
        },
      });
      await tx.valorContribuicao.create({
        data: {
          valorMensal: '100.00',
          valorAnual: '960.00',
          alteradoPorId: adminId,
          criadoEm: new Date('2099-05-10T12:00:00Z'),
        },
      });
      const maio = new Date('2099-05-15T12:00:00Z');

      // Sem edição, o boleto já está com o valor normal.
      await expect(
        servico.editar(adminId, associado.id, '100.00', maio),
      ).rejects.toThrow('O boleto já está com este valor.');
      // Com edição, voltar ao normal é pelo outro botão.
      await servico.editar(adminId, associado.id, '80.00', maio);
      await expect(
        servico.editar(adminId, associado.id, '100.00', maio),
      ).rejects.toMatchObject({
        response: { campo: 'valor' },
        message: expect.stringContaining('Este já é o valor normal'),
      });

      // Antes de qualquer valor cadastrado (o mais antigo dos testes é de 2000).
      const janeiro1990 = new Date('1990-01-15T12:00:00Z');
      await expect(
        servico.proximoBoleto(associado, janeiro1990),
      ).resolves.toMatchObject({ valorNormal: null });
      await expect(
        servico.editar(adminId, associado.id, '80.00', janeiro1990),
      ).rejects.toThrow('A sede ainda não cadastrou o valor da contribuição.');
    });
  });
});
