import { Controller, Get, UseGuards } from '@nestjs/common';
import { CronGuard } from '../auth/guards/cron.guard.js';
import { LoteMensalService } from './lote-mensal.service.js';

/**
 * Tarefas agendadas, chamadas pelo cron da Vercel uma vez por dia
 * (`apps/api/vercel.json`).
 */
@Controller('tarefas')
@UseGuards(CronGuard)
export class TarefasController {
  constructor(private readonly lote: LoteMensalService) {}

  /** Lote mensal de boletos (RF10). */
  @Get('lote-mensal')
  loteMensal() {
    return this.lote.executar();
  }
}
