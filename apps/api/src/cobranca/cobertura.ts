const UM_DIA = 24 * 60 * 60 * 1000;

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
