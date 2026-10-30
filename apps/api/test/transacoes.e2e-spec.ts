// Histórico de transações dos boletos (RN17, RF30): cada mudança do boleto
// vira uma linha nova, junto com a mudança. Roda no banco de teste
// (preparar-banco.mjs). O histórico não pode ser apagado, então o primeiro
// teste desfaz tudo no fim, e o segundo deixa o boleto no banco.
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { TransacoesService } from '../src/cobranca/transacoes.service.js';
import {
  PrismaClient,
  type Transacao,
} from '../src/generated/prisma/client.js';

type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

class Desfazer extends Error {}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});
const servico = new TransacoesService();

function criarAssociado(tx: Tx) {
  return tx.associado.create({
    data: {
      cnpj: crypto.randomUUID().replace(/\D/g, '').padEnd(14, '0').slice(0, 14),
      razaoSocial: 'Farmácia Teste Ltda',
    },
  });
}

function boletoDe(associadoId: string) {
  return {
    associadoId,
    tipo: 'MENSAL' as const,
    competencia: new Date('2026-11-01'),
    vencimento: new Date('2026-11-10'),
    valor: '120.00',
  };
}

describe('Histórico de transações (e2e)', () => {
  afterAll(() => prisma.$disconnect());

  it('cada mudança do boleto vira uma linha, com os dados daquele momento', async () => {
    const nossoNumero = `NN-${crypto.randomUUID()}`;
    let adminId = '';
    let linhas: Transacao[] = [];

    await prisma
      .$transaction(async (tx) => {
        const associado = await criarAssociado(tx);
        const admin = await tx.usuario.create({
          data: {
            email: `transacoes-${crypto.randomUUID()}@example.com`,
            nome: 'Admin de Teste',
            perfil: 'ADMIN',
            senhaHash: 'x',
          },
        });
        adminId = admin.id;

        const { id } = await servico.criarBoleto(tx, boletoDe(associado.id));
        await servico.alterarBoleto(
          tx,
          id,
          {
            status: 'EM_ABERTO',
            sicrediNossoNumero: nossoNumero,
            emitidoEm: new Date(),
          },
          { evento: 'EMITIDO' },
        );
        await servico.alterarBoleto(
          tx,
          id,
          { valor: '150.00' },
          {
            evento: 'EDITADO',
            usuarioId: admin.id,
            detalhes: { motivo: 'Teste.' },
          },
        );
        await servico.alterarBoleto(
          tx,
          id,
          { status: 'PAGO', pagoEm: new Date() },
          { evento: 'PAGO', formaPagamento: 'PIX' },
        );

        linhas = await tx.transacao.findMany({ where: { boletoId: id } });
        throw new Desfazer();
      })
      .catch((erro: unknown) => {
        if (!(erro instanceof Desfazer)) throw erro;
      });

    // Na mesma transação do banco, todas têm a mesma data e hora.
    const linha = (evento: string) =>
      linhas.find((transacao) => transacao.evento === evento);
    expect(linhas).toHaveLength(4);
    expect(linha('GERADO')).toMatchObject({
      sicrediNossoNumero: null,
      usuarioId: null,
    });
    expect(linha('GERADO')?.valor.toFixed(2)).toBe('120.00');
    expect(linha('EMITIDO')?.sicrediNossoNumero).toBe(nossoNumero);
    expect(linha('EDITADO')).toMatchObject({
      usuarioId: adminId,
      detalhes: { motivo: 'Teste.' },
    });
    expect(linha('EDITADO')?.valor.toFixed(2)).toBe('150.00');
    expect(linha('PAGO')).toMatchObject({
      formaPagamento: 'PIX',
      sicrediNossoNumero: nossoNumero,
      usuarioId: null,
    });
    expect(linha('PAGO')?.ocorridoEm).toBeInstanceOf(Date);
  });

  it('se o histórico falha, o boleto não muda', async () => {
    const boleto = await prisma.$transaction(async (tx) =>
      servico.criarBoleto(tx, boletoDe((await criarAssociado(tx)).id)),
    );

    // Usuário que não existe: a linha do histórico é recusada.
    await expect(
      prisma.$transaction((tx) =>
        servico.alterarBoleto(
          tx,
          boleto.id,
          { status: 'CANCELADO' },
          { evento: 'CANCELADO', usuarioId: crypto.randomUUID() },
        ),
      ),
    ).rejects.toThrow();

    await expect(
      prisma.boleto.findUnique({ where: { id: boleto.id } }),
    ).resolves.toMatchObject({ status: 'RASCUNHO' });
    const eventos = await prisma.transacao.findMany({
      where: { boletoId: boleto.id },
      select: { evento: true },
    });
    expect(eventos).toEqual([{ evento: 'GERADO' }]);
  });
});
