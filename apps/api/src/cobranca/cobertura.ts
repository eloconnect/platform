import type { Prisma } from '../generated/prisma/client.js';

const UM_DIA = 24 * 60 * 60 * 1000;

/** Meses que o plano anual cobre (RN13). */
export const MESES_PLANO_ANUAL = 12;

/** Dias para pagar depois do vencimento, antes do bloqueio (RN03, RN09). */
const DIAS_PARA_PAGAR = 30;

/**
 * Último dia com acesso de quem pagou até o mês `competencia` sem receber o
 * boleto todo mês, como no boleto avulso (P10, decisão do grupo com aval do
 * cliente, 24/11/2026): o último dia para pagar o mês seguinte, ou seja, o dia
 * 10 desse mês mais 30 dias. É a mesma folga de quem recebe o boleto todo mês
 * e não paga o próximo (RN02, RN03).
 */
export function ultimoDiaDaCobertura(competencia: Date): Date {
  const vencimentoDoMesSeguinte = Date.UTC(
    competencia.getUTCFullYear(),
    competencia.getUTCMonth() + 1,
    10,
  );
  return new Date(vencimentoDoMesSeguinte + DIAS_PARA_PAGAR * UM_DIA);
}

/** A competência `meses` meses depois (ou antes, se negativo). */
export function somarMeses(competencia: Date, meses: number): Date {
  return new Date(
    Date.UTC(
      competencia.getUTCFullYear(),
      competencia.getUTCMonth() + meses,
      1,
    ),
  );
}

/** Último mês que um boleto pago cobre: o avulso, o dele; o anual, 12. */
export function ultimoMesCoberto(boleto: {
  tipo: string;
  competencia: Date;
}): Date {
  return boleto.tipo === 'ANUAL'
    ? somarMeses(boleto.competencia, MESES_PLANO_ANUAL - 1)
    : boleto.competencia;
}

/**
 * Último mês do plano anual pago, se ele ainda cobre `competencia` ou um mês
 * depois dela. Nulo sem plano em vigor.
 */
export async function planoAnualAte(
  tx: Prisma.TransactionClient,
  associadoId: string,
  competencia: Date,
): Promise<Date | null> {
  const plano = await tx.boleto.findFirst({
    where: {
      associadoId,
      tipo: 'ANUAL',
      status: 'PAGO',
      competencia: { gt: somarMeses(competencia, -MESES_PLANO_ANUAL) },
    },
    orderBy: { competencia: 'desc' },
    select: { tipo: true, competencia: true },
  });
  return plano ? ultimoMesCoberto(plano) : null;
}
