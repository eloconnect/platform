// Lote mensal de boletos (US10: RF10, RN02 a RN05, RN15). Roda no banco de
// teste (preparar-banco.mjs). O histórico dos boletos não pode ser apagado,
// então cada teste roda numa transação desfeita no fim, e o lote de junho de
// 2099 nunca fica no banco.
import 'dotenv/config';
import { jest } from '@jest/globals';
import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import type {
  BoletoEmitido,
  GatewayPagamento,
  PedidoBoleto,
} from '../src/cobranca/gateway-pagamento.js';
import { GatewaySimulado } from '../src/cobranca/gateway-simulado.js';
import { LoteMensalService } from '../src/cobranca/lote-mensal.service.js';
import { TransacoesService } from '../src/cobranca/transacoes.service.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';

process.env.JWT_SECRET ??= 'segredo-so-para-teste-com-mais-de-32-caracteres';

type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

class Desfazer extends Error {}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

/** Segunda, 1º de junho de 2099, às 8h em Mato Grosso: o dia do lote. */
const DIA_DO_LOTE = new Date('2099-06-01T12:00:00Z');
const COMPETENCIA = new Date('2099-06-01');

/**
 * Roda o teste numa transação desfeita no fim. O serviço usa essa mesma
 * transação no lugar do banco, inclusive nas transações dele.
 */
async function desfazendoNoFim(
  teste: (
    tx: Tx,
    lote: (gateway?: GatewayPagamento) => LoteMensalService,
  ) => Promise<void>,
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
          (gateway = new GatewaySimulado()) =>
            new LoteMensalService(banco, new TransacoesService(), gateway),
        );
        throw new Desfazer();
      },
      { timeout: 60_000 },
    )
    .catch((erro: unknown) => {
      if (!(erro instanceof Desfazer)) throw erro;
    });
}

function criarAssociado(
  tx: Tx,
  dados: { contribuicaoAtiva: boolean; inativadoEm?: Date },
) {
  return tx.associado.create({
    data: {
      cnpj: crypto.randomUUID().replace(/\D/g, '').padEnd(14, '0').slice(0, 14),
      razaoSocial: 'Farmácia Teste Ltda',
      ...dados,
    },
  });
}

/** Valores de maio e de junho de 2099, com a virada do mês em Mato Grosso. */
async function criarValores(tx: Tx) {
  const admin = await tx.usuario.create({
    data: {
      email: `lote-${crypto.randomUUID()}@example.com`,
      nome: 'Admin do Lote',
      perfil: 'ADMIN',
      senhaHash: 'x',
    },
  });
  const valores: [string, string][] = [
    ['100.00', '2099-05-20T12:00:00Z'],
    // 31 de maio, 23h em Mato Grosso: ainda vale para junho.
    ['110.00', '2099-06-01T03:00:00Z'],
    // 1º de junho, 1h em Mato Grosso: só vale para julho (RN15).
    ['999.00', '2099-06-01T05:00:00Z'],
  ];
  for (const [valorMensal, criadoEm] of valores) {
    await tx.valorContribuicao.create({
      data: {
        valorMensal,
        valorAnual: valorMensal,
        alteradoPorId: admin.id,
        criadoEm: new Date(criadoEm),
      },
    });
  }
}

function boletosDoMes(tx: Tx, associadoId: string) {
  return tx.boleto.findMany({
    where: { associadoId, competencia: COMPETENCIA },
    include: { transacoes: { orderBy: { evento: 'asc' } } },
  });
}

/** Banco que fica fora do ar para um CNPJ até `voltar()`. */
class GatewayInstavel extends GatewaySimulado {
  private fora = true;

  constructor(private readonly cnpj: string) {
    super();
  }

  voltar() {
    this.fora = false;
  }

  async emitir(pedido: PedidoBoleto): Promise<BoletoEmitido> {
    if (this.fora && pedido.pagador.cnpj === this.cnpj) {
      throw new Error('Banco fora do ar.');
    }
    return super.emitir(pedido);
  }
}

describe('Lote mensal (e2e)', () => {
  beforeAll(() => {
    // O erro do banco fora do ar vai para o log de propósito.
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterAll(() => prisma.$disconnect());

  it('não faz nada antes do primeiro dia útil, no horário de Mato Grosso', async () => {
    await desfazendoNoFim(async (_tx, lote) => {
      // 2 de novembro de 2026, 23h30 em Mato Grosso: Finados. O lote de
      // novembro sai no dia 3.
      await expect(
        lote().executar(new Date('2026-11-03T03:30:00Z')),
      ).resolves.toEqual({
        situacao: 'ANTES_DO_DIA_UTIL',
        competencia: '2026-11',
      });
    });
  });

  it('gera e emite o boleto de quem tem contribuição ativa, com o valor em vigor', async () => {
    await desfazendoNoFim(async (tx, lote) => {
      await criarValores(tx);
      const ativo = await criarAssociado(tx, { contribuicaoAtiva: true });
      const semContribuicao = await criarAssociado(tx, {
        contribuicaoAtiva: false,
      });
      const inativado = await criarAssociado(tx, {
        contribuicaoAtiva: true,
        inativadoEm: new Date('2099-05-01'),
      });
      // Já tem o boleto do mês, gerado na adesão (RN23).
      const aderiu = await criarAssociado(tx, { contribuicaoAtiva: true });
      await tx.boleto.create({
        data: {
          associadoId: aderiu.id,
          tipo: 'MENSAL',
          competencia: COMPETENCIA,
          valor: '110.00',
          vencimento: new Date('2099-06-10'),
          status: 'EM_ABERTO',
        },
      });
      // O boleto cancelado não conta.
      const cancelado = await criarAssociado(tx, { contribuicaoAtiva: true });
      await tx.boleto.create({
        data: {
          associadoId: cancelado.id,
          tipo: 'MENSAL',
          competencia: COMPETENCIA,
          valor: '110.00',
          vencimento: new Date('2099-06-10'),
          status: 'CANCELADO',
        },
      });

      // A sede mudou o valor só do boleto de junho (RN04). A edição de julho
      // não vale para junho.
      const editado = await criarAssociado(tx, { contribuicaoAtiva: true });
      await tx.edicaoBoleto.create({
        data: {
          associadoId: editado.id,
          competencia: COMPETENCIA,
          valor: '80.00',
        },
      });
      await tx.edicaoBoleto.create({
        data: {
          associadoId: ativo.id,
          competencia: new Date('2099-07-01'),
          valor: '70.00',
        },
      });

      const resultado = await lote().executar(DIA_DO_LOTE);

      expect(resultado).toMatchObject({
        situacao: 'ENVIADO',
        competencia: '2099-06',
        pendentes: 0,
      });
      const registro = await tx.loteMensal.findUniqueOrThrow({
        where: { competencia: COMPETENCIA },
      });
      expect(registro.status).toBe('ENVIADO');
      expect(registro.enviadoEm).toBeInstanceOf(Date);

      const [boleto] = await boletosDoMes(tx, ativo.id);
      expect(boleto).toMatchObject({
        loteId: registro.id,
        tipo: 'MENSAL',
        vencimento: new Date('2099-06-10'),
        status: 'EM_ABERTO',
      });
      expect(boleto.valor.toFixed(2)).toBe('110.00');
      expect(boleto.sicrediNossoNumero).toMatch(/^SIM\d{12}$/);
      expect(boleto.linhaDigitavel).toBeTruthy();
      expect(boleto.pixCopiaECola).toBeTruthy();
      expect(boleto.emitidoEm).toBeInstanceOf(Date);
      // Feito pelo sistema, sem ninguém da sede.
      expect(
        boleto.transacoes.map(({ evento, usuarioId }) => [evento, usuarioId]),
      ).toEqual([
        ['GERADO', null],
        ['EMITIDO', null],
      ]);

      const loteDe = async (associadoId: string) =>
        (await boletosDoMes(tx, associadoId)).filter(
          ({ loteId }) => loteId === registro.id,
        );
      expect(await loteDe(cancelado.id)).toHaveLength(1);
      expect(await loteDe(semContribuicao.id)).toHaveLength(0);
      expect(await loteDe(inativado.id)).toHaveLength(0);
      expect(await loteDe(aderiu.id)).toHaveLength(0);
      const [boletoEditado] = await loteDe(editado.id);
      expect(boletoEditado.valor.toFixed(2)).toBe('80.00');

      // Rodar de novo, no mesmo dia ou depois, não gera nem emite nada.
      for (const dia of [DIA_DO_LOTE, new Date('2099-06-15T12:00:00Z')]) {
        await expect(lote().executar(dia)).resolves.toEqual({
          situacao: 'ENVIADO',
          competencia: '2099-06',
          emitidos: 0,
          pendentes: 0,
        });
      }
      expect(await boletosDoMes(tx, ativo.id)).toHaveLength(1);
    });
  });

  it('se o banco falha, a execução do dia seguinte emite o que faltou', async () => {
    await desfazendoNoFim(async (tx, lote) => {
      await criarValores(tx);
      const associado = await criarAssociado(tx, { contribuicaoAtiva: true });
      const gateway = new GatewayInstavel(associado.cnpj);

      await expect(lote(gateway).executar(DIA_DO_LOTE)).resolves.toMatchObject({
        situacao: 'INCOMPLETO',
        pendentes: 1,
      });
      let [boleto] = await boletosDoMes(tx, associado.id);
      expect(boleto.status).toBe('RASCUNHO');
      expect(boleto.transacoes.map(({ evento }) => evento)).toEqual(['GERADO']);
      expect(
        (
          await tx.loteMensal.findUniqueOrThrow({
            where: { competencia: COMPETENCIA },
          })
        ).status,
      ).toBe('RASCUNHO');

      gateway.voltar();
      await expect(
        lote(gateway).executar(new Date('2099-06-02T12:00:00Z')),
      ).resolves.toEqual({
        situacao: 'ENVIADO',
        competencia: '2099-06',
        emitidos: 1,
        pendentes: 0,
      });
      [boleto] = await boletosDoMes(tx, associado.id);
      expect(boleto.status).toBe('EM_ABERTO');
    });
  });

  it('sem valor cadastrado antes do mês, não gera o lote', async () => {
    await desfazendoNoFim(async (tx, lote) => {
      // 2 de janeiro de 1990, o primeiro dia útil do mês.
      await expect(
        lote().executar(new Date('1990-01-02T12:00:00Z')),
      ).rejects.toThrow('A sede ainda não cadastrou o valor da contribuição.');
      await expect(
        tx.loteMensal.findUnique({
          where: { competencia: new Date('1990-01-01') },
        }),
      ).resolves.toBeNull();
    });
  });
});

describe('Rota do lote mensal (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = modulo.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  const http = () => request(app.getHttpServer());

  it('só responde ao cron, que manda o CRON_SECRET', async () => {
    const semSegredo = await http().get('/tarefas/lote-mensal');
    const outroSegredo = await http()
      .get('/tarefas/lote-mensal')
      .set('Authorization', 'Bearer outro-segredo');
    expect([semSegredo.status, outroSegredo.status]).toEqual([401, 401]);
  });
});
