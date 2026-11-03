// Fluxo da cobrança de ponta a ponta (#59), com os serviços de verdade e as
// datas simuladas em 2097, que nenhum outro teste usa: adesão, pagamento,
// lote, lembretes e bloqueio; a interrupção pela sede; e o cancelamento
// confirmado sem resposta. O histórico dos boletos não pode ser apagado,
// então cada fluxo roda numa transação desfeita no fim.
import 'dotenv/config';
import { jest } from '@jest/globals';
import { TERMO_ADESAO } from '@eloconnect/shared';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { AssociadosService } from '../src/associados/associados.service.js';
import { AuditoriaService } from '../src/auditoria/auditoria.service.js';
import { CancelamentosService } from '../src/cancelamentos/cancelamentos.service.js';
import { AdesaoService } from '../src/cobranca/adesao.service.js';
import { BloqueioService } from '../src/cobranca/bloqueio.service.js';
import { primeiroDiaUtil } from '../src/cobranca/dia-util.js';
import { EdicaoBoletoService } from '../src/cobranca/edicao-boleto.service.js';
import { EmailBoletoService } from '../src/cobranca/email-boleto.service.js';
import { GatewaySimulado } from '../src/cobranca/gateway-simulado.js';
import { LembretesService } from '../src/cobranca/lembretes.service.js';
import { LoteMensalService } from '../src/cobranca/lote-mensal.service.js';
import { PagamentosService } from '../src/cobranca/pagamentos.service.js';
import { TransacoesService } from '../src/cobranca/transacoes.service.js';
import type { EmailMessage, EmailService } from '../src/email/email.service.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';

// O lote e o bloqueio passam por todos os associados do banco de teste, que
// guarda os dados de outros testes e cresce a cada rodada. Por isso, o lote
// roda só no primeiro fluxo: que ele deixa de fora quem não recebe o boleto,
// o teste do lote mensal já confere.
jest.setTimeout(120_000);

type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

class Desfazer extends Error {}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

/** E-mails "enviados", no lugar do SMTP. */
const enviados: EmailMessage[] = [];
const email = {
  send: (mensagem: EmailMessage) => {
    enviados.push(mensagem);
    return Promise.resolve();
  },
} as unknown as EmailService;
const emailsPara = (endereco: string | null) =>
  enviados.filter(({ to }) => to === endereco).map(({ subject }) => subject);

/** Meio-dia em UTC (8h em Mato Grosso) de um dia de 2097. */
const dia = (mes: number, numero: number) =>
  new Date(Date.UTC(2097, mes - 1, numero, 12));

/** O dia do lote do mês: o primeiro dia útil (RN02). */
const diaDoLote = (mes: number) =>
  dia(mes, primeiroDiaUtil({ ano: 2097, mes }));

/** Os serviços da cobrança, todos sobre a mesma transação. */
function servicos(banco: PrismaService) {
  const gateway = new GatewaySimulado();
  const transacoes = new TransacoesService();
  const auditoria = new AuditoriaService();
  const config = new ConfigService();
  const emailBoleto = new EmailBoletoService(banco, gateway, email, config);
  return {
    adesao: new AdesaoService(banco, transacoes, gateway, emailBoleto),
    lote: new LoteMensalService(banco, transacoes, gateway, emailBoleto),
    lembretes: new LembretesService(banco, emailBoleto),
    bloqueio: new BloqueioService(banco, transacoes),
    pagamentos: new PagamentosService(banco, transacoes, auditoria, gateway),
    associados: new AssociadosService(
      banco,
      auditoria,
      email,
      new EdicaoBoletoService(banco, auditoria, email),
    ),
    cancelamentos: new CancelamentosService(banco, auditoria, email, config),
  };
}

/**
 * Roda o fluxo numa transação desfeita no fim. Os serviços usam essa mesma
 * transação no lugar do banco, inclusive nas transações deles.
 */
async function desfazendoNoFim(
  fluxo: (tx: Tx, s: ReturnType<typeof servicos>) => Promise<void>,
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
        // O valor de maio de 2097 em diante, cadastrado em abril.
        const admin = await tx.usuario.create({
          data: {
            email: `fluxo-${crypto.randomUUID()}@example.com`,
            nome: 'Admin do Fluxo',
            perfil: 'ADMIN',
            senhaHash: 'x',
          },
        });
        await tx.valorContribuicao.create({
          data: {
            valorMensal: '120.00',
            valorAnual: '1152.00',
            alteradoPorId: admin.id,
            criadoEm: new Date('2097-04-20T12:00:00Z'),
          },
        });
        await fluxo(tx, servicos(banco));
        throw new Desfazer();
      },
      { timeout: 120_000 },
    )
    .catch((erro: unknown) => {
      if (!(erro instanceof Desfazer)) throw erro;
    });
}

/** Associado com conta, para os fluxos do próprio associado. */
async function criarAssociado(tx: Tx, dados: object = {}) {
  const marcador = crypto.randomUUID();
  const associado = await tx.associado.create({
    data: {
      cnpj: marcador.replace(/\D/g, '').padEnd(14, '0').slice(0, 14),
      razaoSocial: 'Farmácia do Fluxo Ltda',
      email: `fluxo-${marcador}@example.com`,
      ...dados,
    },
  });
  const usuario = await tx.usuario.create({
    data: {
      email: `fluxo-conta-${marcador}@example.com`,
      nome: 'Responsável',
      perfil: 'ASSOCIADO',
      senhaHash: 'x',
      associadoId: associado.id,
    },
  });
  return { associado, usuarioId: usuario.id };
}

const situacao = async (tx: Tx, id: string) =>
  tx.associado.findUniqueOrThrow({
    where: { id },
    select: { situacao: true, contribuicaoAtiva: true },
  });

beforeAll(() => {
  // Os erros esperados (como o boleto que expira) ficam fora da saída.
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
});

beforeEach(() => {
  enviados.length = 0;
});

afterAll(() => prisma.$disconnect());

describe('Fluxo da cobrança (e2e)', () => {
  it('adesão, pagamento e desbloqueio; depois o lote, os lembretes e o bloqueio', async () => {
    await desfazendoNoFim(async (tx, s) => {
      const { associado, usuarioId } = await criarAssociado(tx);

      // 12 de maio: o associado adere, e o boleto do mês sai na hora.
      await expect(
        s.adesao.aderir(usuarioId, TERMO_ADESAO.versao, dia(5, 12)),
      ).resolves.toEqual({ boletoGerado: true });
      const maio = await tx.boleto.findFirstOrThrow({
        where: { associadoId: associado.id },
      });
      expect(maio).toMatchObject({ status: 'EM_ABERTO', tipo: 'MENSAL' });
      expect(emailsPara(associado.email)).toHaveLength(1);
      // Até pagar o primeiro boleto, ele não está em dia (#43).
      expect(await situacao(tx, associado.id)).toEqual({
        situacao: 'INADIMPLENTE',
        contribuicaoAtiva: true,
      });

      // 20 de maio: o banco confirma o pagamento, e o acesso abre (RN10).
      await expect(
        s.pagamentos.confirmar({
          nossoNumero: maio.sicrediNossoNumero ?? '',
          formaPagamento: 'PIX',
          valorPago: maio.valor,
          pagoEm: dia(5, 20),
        }),
      ).resolves.toMatchObject({ desbloqueado: true });
      expect((await situacao(tx, associado.id)).situacao).toBe('ADIMPLENTE');

      // Primeiro dia útil de junho: o lote manda o boleto de junho (RN02).
      await s.lote.executar(diaDoLote(6));
      const junho = await tx.boleto.findFirstOrThrow({
        where: {
          associadoId: associado.id,
          competencia: new Date('2097-06-01'),
        },
      });
      expect(junho).toMatchObject({
        status: 'EM_ABERTO',
        vencimento: new Date('2097-06-10'),
      });
      expect(emailsPara(associado.email)).toHaveLength(2);

      // Dois dias antes do vencimento e uma semana depois: os lembretes.
      await s.lembretes.executar(dia(6, 8));
      await s.lembretes.executar(dia(6, 17));
      expect(emailsPara(associado.email)).toHaveLength(4);

      // 10 de julho, o último dia para pagar: o acesso continua.
      await s.bloqueio.executar(dia(7, 10));
      expect((await situacao(tx, associado.id)).situacao).toBe('ADIMPLENTE');
      // 11 de julho: o boleto expira, e o acesso fecha (RN09).
      await s.bloqueio.executar(dia(7, 11));
      expect(
        (await tx.boleto.findUniqueOrThrow({ where: { id: junho.id } })).status,
      ).toBe('EXPIRADO');
      expect((await situacao(tx, associado.id)).situacao).toBe('INADIMPLENTE');
    });
  });

  it('a sede interrompe a cobrança: o boleto mensal para, e o acesso dura mais 30 dias', async () => {
    await desfazendoNoFim(async (tx, s) => {
      const { associado } = await criarAssociado(tx, {
        situacao: 'ADIMPLENTE',
        contribuicaoAtiva: true,
      });
      const admin = await tx.usuario.findFirstOrThrow({
        where: { nome: 'Admin do Fluxo' },
        orderBy: { criadoEm: 'desc' },
      });

      await s.associados.interromperCobranca(
        admin.id,
        associado.id,
        'Motivo fictício',
        dia(6, 15),
      );
      // Sem a contribuição ativa, ele sai do lote e dos lembretes (RN05).
      expect(await situacao(tx, associado.id)).toEqual({
        situacao: 'ADIMPLENTE',
        contribuicaoAtiva: false,
      });

      // O acesso vai até 15 de julho e fecha no dia 16 (RN25).
      await s.bloqueio.executar(dia(7, 15));
      expect((await situacao(tx, associado.id)).situacao).toBe('ADIMPLENTE');
      await s.bloqueio.executar(dia(7, 16));
      expect((await situacao(tx, associado.id)).situacao).toBe('INADIMPLENTE');
    });
  });

  it('o associado pede o cancelamento, e sem resposta da sede ele vale no 16º dia', async () => {
    await desfazendoNoFim(async (tx, s) => {
      const { associado, usuarioId } = await criarAssociado(tx, {
        situacao: 'ADIMPLENTE',
        contribuicaoAtiva: true,
      });

      await s.cancelamentos.pedir(usuarioId, dia(6, 15));
      const pedido = async () =>
        (
          await tx.solicitacaoCancelamento.findFirstOrThrow({
            where: { associadoId: associado.id },
          })
        ).status;

      // A sede pode responder até 30 de junho; no dia 1º, o pedido vale.
      await s.cancelamentos.confirmarSemResposta(dia(6, 30));
      expect(await pedido()).toBe('PENDENTE');
      await s.cancelamentos.confirmarSemResposta(dia(7, 1));
      expect(await pedido()).toBe('CONFIRMADA_AUTOMATICAMENTE');
      expect(emailsPara(associado.email)).toContain(
        'O cancelamento foi confirmado - Elo Connect',
      );

      // Ele deixa de receber o boleto mensal e os lembretes.
      expect((await situacao(tx, associado.id)).contribuicaoAtiva).toBe(false);

      // TODO(P25): como na interrupção, o acesso vai até 31 de julho.
      await s.bloqueio.executar(dia(7, 31));
      expect((await situacao(tx, associado.id)).situacao).toBe('ADIMPLENTE');
      await s.bloqueio.executar(dia(8, 1));
      expect(await situacao(tx, associado.id)).toEqual({
        situacao: 'INADIMPLENTE',
        contribuicaoAtiva: false,
      });
    });
  });
});
