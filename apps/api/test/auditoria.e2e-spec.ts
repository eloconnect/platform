// O log de auditoria entra na mesma transação da alteração (RN26, RF39).
// Precisa do PostgreSQL com as migrations aplicadas. Como o log não pode ser
// apagado, cada teste desfaz a própria transação no fim.
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import {
  AuditoriaService,
  diferencas,
  type Transacao,
} from '../src/auditoria/auditoria.service.js';

class Desfazer extends Error {}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});
const auditoria = new AuditoriaService();

/** Roda a operação numa transação e desfaz tudo no fim. */
async function dentroDeTransacaoDesfeita(
  operacao: (tx: Transacao) => Promise<void>,
) {
  await prisma
    .$transaction(async (tx) => {
      await operacao(tx);
      throw new Desfazer();
    })
    .catch((e: unknown) => {
      if (!(e instanceof Desfazer)) throw e;
    });
}

async function criarBase(tx: Transacao) {
  const sufixo = crypto.randomUUID();
  const admin = await tx.usuario.create({
    data: {
      email: `auditoria-${sufixo}@example.com`,
      nome: 'Admin de Teste',
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
  return { admin, associado };
}

describe('Log de auditoria', () => {
  afterAll(() => prisma.$disconnect());

  it('grava quem, o quê, quando e os valores anterior e novo', async () => {
    await dentroDeTransacaoDesfeita(async (tx) => {
      const { admin, associado } = await criarBase(tx);
      const depois = await tx.associado.update({
        where: { id: associado.id },
        data: { telefone: '(65) 90000-0000' },
      });

      await auditoria.registrar(tx, {
        usuarioId: admin.id,
        acao: 'ASSOCIADO_EDITADO',
        entidade: 'Associado',
        entidadeId: associado.id,
        associadoId: associado.id,
        ...diferencas(associado, { telefone: depois.telefone }),
      });

      const logs = await tx.logAuditoria.findMany({
        where: { entidadeId: associado.id },
      });
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        usuarioId: admin.id,
        acao: 'ASSOCIADO_EDITADO',
        associadoId: associado.id,
        valorAnterior: { telefone: null },
        valorNovo: { telefone: '(65) 90000-0000' },
      });
      expect(logs[0].ocorridoEm).toBeInstanceOf(Date);
    });
  });

  it('não deixa registro quando a alteração falha', async () => {
    let associadoId = '';
    const falha = prisma.$transaction(async (tx) => {
      const { admin, associado } = await criarBase(tx);
      associadoId = associado.id;
      await auditoria.registrar(tx, {
        usuarioId: admin.id,
        acao: 'ASSOCIADO_INATIVADO',
        entidade: 'Associado',
        entidadeId: associado.id,
        associadoId: associado.id,
      });
      throw new Error('falha depois do registro');
    });

    await expect(falha).rejects.toThrow('falha depois do registro');
    expect(associadoId).not.toBe('');
    await expect(
      prisma.logAuditoria.count({ where: { entidadeId: associadoId } }),
    ).resolves.toBe(0);
  });
});
