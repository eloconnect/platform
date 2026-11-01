import { Controller, Get, UseGuards } from '@nestjs/common';
import { CronGuard } from '../auth/guards/cron.guard.js';
import { BloqueioService } from './bloqueio.service.js';
import { LembretesService } from './lembretes.service.js';
import { LoteMensalService } from './lote-mensal.service.js';

/**
 * Tarefas agendadas, chamadas pelo cron da Vercel uma vez por dia
 * (`apps/api/vercel.json`).
 */
@Controller('tarefas')
@UseGuards(CronGuard)
export class TarefasController {
  constructor(
    private readonly lote: LoteMensalService,
    private readonly bloqueio: BloqueioService,
    private readonly lembretes: LembretesService,
  ) {}

  /** Lote mensal de boletos (RF10). */
  @Get('lote-mensal')
  loteMensal() {
    return this.lote.executar();
  }

  /** Bloqueio de quem deixou o boleto expirar sem pagamento (RF16). */
  @Get('bloqueio')
  bloqueioAutomatico() {
    return this.bloqueio.executar();
  }

  /** Lembretes antes e depois do vencimento (RF13, RF14). */
  @Get('lembretes')
  lembretesDoDia() {
    return this.lembretes.executar();
  }
}
