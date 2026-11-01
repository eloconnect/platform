import { FUSO_SEDE_HORAS, type Competencia } from '@eloconnect/shared';
import type { Prisma } from '../generated/prisma/client.js';

const UMA_HORA = 60 * 60 * 1000;

/** Competência como o banco guarda: o dia 1 do mês, à meia-noite UTC. */
export function dataDaCompetencia({ ano, mes }: Competencia): Date {
  return new Date(Date.UTC(ano, mes - 1, 1));
}

/** O dia de hoje em Mato Grosso, à meia-noite UTC, como o banco guarda dias. */
export function hojeEmMatoGrosso(agora: Date): Date {
  const local = new Date(agora.getTime() + FUSO_SEDE_HORAS * UMA_HORA);
  return new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()),
  );
}

/** O instante em que um dia começa em Mato Grosso (meia-noite local). */
export function inicioDoDiaEmMatoGrosso(dia: Date): Date {
  return new Date(dia.getTime() - FUSO_SEDE_HORAS * UMA_HORA);
}

/** "AAAA-MM-DD" de um dia guardado à meia-noite UTC. */
export function textoDia(dia: Date): string {
  return dia.toISOString().slice(0, 10);
}

/** O contrário de `dataDaCompetencia`. */
export function competenciaDaData(data: Date): Competencia {
  return { ano: data.getUTCFullYear(), mes: data.getUTCMonth() + 1 };
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
