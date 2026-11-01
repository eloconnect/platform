import type { Competencia } from '@eloconnect/shared';

const UM_DIA = 24 * 60 * 60 * 1000;

/** Feriados nacionais de data fixa, em MM-DD. */
const FERIADOS_FIXOS = [
  '01-01',
  '04-21',
  '05-01',
  '09-07',
  '10-12',
  '11-02',
  '11-15',
  '11-20',
  '12-25',
];

/** Domingo de Páscoa, pelo algoritmo de Meeus/Jones/Butcher. */
export function pascoa(ano: number): Date {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(ano, mes - 1, dia));
}

/**
 * Dia útil: de segunda a sexta, fora os feriados nacionais e a Sexta-feira
 * Santa. Carnaval e Corpus Christi são ponto facultativo e contam como dia
 * útil (decisão do grupo, 31/10/2026). `data` é um dia à meia-noite UTC.
 */
export function ehDiaUtil(data: Date): boolean {
  const semana = data.getUTCDay();
  if (semana === 0 || semana === 6) return false;
  if (FERIADOS_FIXOS.includes(data.toISOString().slice(5, 10))) return false;
  const sextaSanta = pascoa(data.getUTCFullYear()).getTime() - 2 * UM_DIA;
  return data.getTime() !== sextaSanta;
}

/** Dia do mês em que cai o primeiro dia útil, quando o lote sai (RN02). */
export function primeiroDiaUtil({ ano, mes }: Competencia): number {
  let dia = 1;
  while (!ehDiaUtil(new Date(Date.UTC(ano, mes - 1, dia)))) dia++;
  return dia;
}
