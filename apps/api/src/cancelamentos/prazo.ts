import {
  hojeEmMatoGrosso,
  inicioDoDiaEmMatoGrosso,
  textoDia,
} from '../cobranca/valor-do-mes.js';

const UM_DIA = 24 * 60 * 60 * 1000;

/** Dias que a sede tem para recusar um pedido de cancelamento (RN18). */
export const DIAS_PARA_RESPONDER = 15;

/**
 * Último dia para a sede responder ("AAAA-MM-DD"): 15 dias corridos depois do
 * dia do pedido, no horário de Mato Grosso. Um pedido de 02/11 pode ser
 * recusado até 17/11 e é confirmado no dia 18 (decisão do grupo, 02/11/2026).
 */
export function respostaAte(solicitadaEm: Date): string {
  return textoDia(
    new Date(
      hojeEmMatoGrosso(solicitadaEm).getTime() + DIAS_PARA_RESPONDER * UM_DIA,
    ),
  );
}

/** Os pedidos feitos antes deste instante já passaram do prazo hoje. */
export function prazoVencidoAntesDe(agora: Date): Date {
  return inicioDoDiaEmMatoGrosso(
    new Date(hojeEmMatoGrosso(agora).getTime() - DIAS_PARA_RESPONDER * UM_DIA),
  );
}
