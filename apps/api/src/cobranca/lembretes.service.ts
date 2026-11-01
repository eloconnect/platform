import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  EmailBoletoService,
  type TipoEmailBoleto,
} from './email-boleto.service.js';
import {
  hojeEmMatoGrosso,
  inicioDoDiaEmMatoGrosso,
  textoDia,
} from './valor-do-mes.js';

const UM_DIA = 24 * 60 * 60 * 1000;

/** O que uma execução fez, para o log da hospedagem. */
export interface ResultadoLembretes {
  /** Dia da execução, no horário de Mato Grosso. */
  dia: string;
  enviados: number;
  /** Lembretes que não saíram; a próxima execução tenta de novo. */
  falhas: number;
}

/**
 * Qual lembrete o boleto em aberto recebe hoje, se algum (RN07). Os dias são
 * do calendário de Mato Grosso, à meia-noite UTC.
 *
 * - Antes do vencimento: 2 dias antes (48h, RF13). Se a execução desse dia
 *   falhar, o lembrete sai na véspera.
 * - Depois do vencimento: um por semana, 7, 14, 21 e 28 dias depois, até o
 *   último dia para pagar, 30 dias depois do vencimento (RF14, RN09). Se a
 *   execução de um desses dias falhar, o lembrete sai num dos dias seguintes
 *   da mesma semana (decisão do grupo, 01/11/2026).
 */
export function lembreteDevido(
  boleto: { vencimento: Date; ultimoLembreteEm: Date | null },
  hoje: Date,
): Exclude<TipoEmailBoleto, 'BOLETO'> | null {
  const dias = Math.round(
    (hoje.getTime() - boleto.vencimento.getTime()) / UM_DIA,
  );
  /** Ainda não saiu lembrete desde o começo desse dia. */
  const semLembreteDesde = (diasDoVencimento: number) =>
    !boleto.ultimoLembreteEm ||
    boleto.ultimoLembreteEm <
      inicioDoDiaEmMatoGrosso(
        new Date(boleto.vencimento.getTime() + diasDoVencimento * UM_DIA),
      );

  if (dias >= -2 && dias < 0) {
    return semLembreteDesde(-2) ? 'LEMBRETE_ANTES' : null;
  }
  if (dias >= 7 && dias <= 30) {
    return semLembreteDesde(Math.floor(dias / 7) * 7)
      ? 'LEMBRETE_VENCIDO'
      : null;
  }
  return null;
}

/**
 * Lembretes antes e depois do vencimento (US13 e US14: RF13, RF14, RN07). O
 * cron chama `executar` todo dia. Só recebe lembrete quem tem contribuição
 * ativa e e-mail no cadastro, e os lembretes param quando o boleto é pago ou
 * expira.
 */
@Injectable()
export class LembretesService {
  private readonly logger = new Logger(LembretesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailBoleto: EmailBoletoService,
  ) {}

  async executar(agora = new Date()): Promise<ResultadoLembretes> {
    const hoje = hojeEmMatoGrosso(agora);
    const boletos = await this.prisma.boleto.findMany({
      where: {
        status: 'EM_ABERTO',
        linhaDigitavel: { not: null },
        vencimento: {
          gte: new Date(hoje.getTime() - 30 * UM_DIA),
          lte: new Date(hoje.getTime() + 2 * UM_DIA),
        },
        associado: { contribuicaoAtiva: true, email: { not: null } },
      },
      select: { id: true, vencimento: true, ultimoLembreteEm: true },
      orderBy: { id: 'asc' },
    });

    let enviados = 0;
    let falhas = 0;
    // Um e-mail de cada vez, aguardando cada envio, como no lote.
    for (const boleto of boletos) {
      const tipo = lembreteDevido(boleto, hoje);
      if (!tipo) continue;
      try {
        await this.emailBoleto.enviar(boleto.id, tipo, agora);
        enviados++;
      } catch (erro) {
        falhas++;
        this.logger.error(
          `O lembrete do boleto ${boleto.id} não saiu.`,
          erro instanceof Error ? erro.stack : undefined,
        );
      }
    }
    return { dia: textoDia(hoje), enviados, falhas };
  }
}
