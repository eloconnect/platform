import { FUSO_SEDE_HORAS, type Competencia } from '@eloconnect/shared';
import type { Prisma } from '../generated/prisma/client.js';

const UMA_HORA = 60 * 60 * 1000;

/** Competência como o banco guarda: o dia 1 do mês, à meia-noite UTC. */
export function dataDaCompetencia({ ano, mes }: Competencia): Date {
  return new Date(Date.UTC(ano, mes - 1, 1));
}

/**
 * Valor da contribuição para o boleto de um mês: o último alterado antes do
 * dia 1 desse mês, no horário de Mato Grosso (RN15). Nulo enquanto a sede não
 * cadastrou nenhum.
 */
export async function valorDoMes(
  tx: Prisma.TransactionClient,
  competencia: Date,
): Promise<Prisma.Decimal | null> {
  // Meia-noite do dia 1 em Mato Grosso.
  const inicioDoMes = new Date(
    competencia.getTime() - FUSO_SEDE_HORAS * UMA_HORA,
  );
  const valor = await tx.valorContribuicao.findFirst({
    where: { criadoEm: { lt: inicioDoMes } },
    orderBy: [{ criadoEm: 'desc' }, { id: 'desc' }],
    select: { valorMensal: true },
  });
  return valor?.valorMensal ?? null;
}
