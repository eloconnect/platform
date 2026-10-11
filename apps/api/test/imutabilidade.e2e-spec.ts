// As tabelas de histórico só aceitam inclusão (RN16, RN17, RN26, RNF06).
// A regra é garantida por triggers no banco (migration init), então este
// teste precisa do PostgreSQL rodando com as migrations aplicadas.
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

class Desfazer extends Error {}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

/**
 * Cria os registros necessários, tenta a operação proibida e desfaz tudo no
 * fim (os registros de teste não poderiam ser apagados depois).
 */
async function tentar(operacao: (tx: Tx) => Promise<unknown>) {
  let erro: unknown = null;
  await prisma
    .$transaction(async (tx) => {
      erro = await operacao(tx).then(
        () => null,
        (e: unknown) => e,
      );
      throw new Desfazer();
    })
    .catch((e: unknown) => {
      if (!(e instanceof Desfazer)) throw e;
    });
  return erro;
}

async function criarBase(tx: Tx) {
  const sufixo = crypto.randomUUID();
  const usuario = await tx.usuario.create({
    data: {
      email: `teste-${sufixo}@example.com`,
      nome: 'Teste',
      perfil: 'ADMIN',
      senhaHash: 'x',
    },
  });
  const associado = await tx.associado.create({
    data: {
      cnpj: sufixo.replace(/\D/g, '').padEnd(14, '0').slice(0, 14),
      razaoSocial: 'Farmácia Teste Ltda',
    },
  });
  const boleto = await tx.boleto.create({
    data: {
      associadoId: associado.id,
      tipo: 'MENSAL',
      competencia: new Date('2026-01-01'),
      vencimento: new Date('2026-01-10'),
      valor: '100.00',
    },
  });
  return { usuario, associado, boleto };
}

function esperarBloqueio(erro: unknown) {
  expect(erro).toBeInstanceOf(Error);
  expect(String(erro)).toMatch(/imutável/);
}

describe('Tabelas imutáveis', () => {
  afterAll(() => prisma.$disconnect());

  it.each(['update', 'delete'] as const)(
    'ValorContribuicao recusa %s',
    async (operacao) => {
      const erro = await tentar(async (tx) => {
        const { usuario } = await criarBase(tx);
        const valor = await tx.valorContribuicao.create({
          data: {
            valorMensal: '100.00',
            valorAnual: '960.00',
            alteradoPorId: usuario.id,
          },
        });
        if (operacao === 'update') {
          await tx.valorContribuicao.update({
            where: { id: valor.id },
            data: { valorMensal: '1.00' },
          });
        } else {
          await tx.valorContribuicao.delete({ where: { id: valor.id } });
        }
      });
      esperarBloqueio(erro);
    },
  );

  it.each(['update', 'delete'] as const)(
    'Transacao recusa %s',
    async (operacao) => {
      const erro = await tentar(async (tx) => {
        const { associado, boleto } = await criarBase(tx);
        const transacao = await tx.transacao.create({
          data: {
            boletoId: boleto.id,
            associadoId: associado.id,
            evento: 'GERADO',
            valor: '100.00',
          },
        });
        if (operacao === 'update') {
          await tx.transacao.update({
            where: { id: transacao.id },
            data: { valor: '0.00' },
          });
        } else {
          await tx.transacao.delete({ where: { id: transacao.id } });
        }
      });
      esperarBloqueio(erro);
    },
  );

  it.each(['update', 'delete'] as const)(
    'LogAuditoria recusa %s',
    async (operacao) => {
      const erro = await tentar(async (tx) => {
        const { usuario } = await criarBase(tx);
        const log = await tx.logAuditoria.create({
          data: { usuarioId: usuario.id, acao: 'TESTE', entidade: 'Teste' },
        });
        if (operacao === 'update') {
          await tx.logAuditoria.update({
            where: { id: log.id },
            data: { acao: 'ALTERADO' },
          });
        } else {
          await tx.logAuditoria.delete({ where: { id: log.id } });
        }
      });
      esperarBloqueio(erro);
    },
  );

  it('aceita inclusão normalmente', async () => {
    const erro = await tentar(async (tx) => {
      const { usuario } = await criarBase(tx);
      await tx.logAuditoria.create({
        data: { usuarioId: usuario.id, acao: 'TESTE', entidade: 'Teste' },
      });
    });
    expect(erro).toBeNull();
  });
});
