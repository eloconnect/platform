import { Controller, Get, UseGuards } from '@nestjs/common';
import { CronGuard } from '../auth/guards/cron.guard.js';
import { CancelamentosService } from './cancelamentos.service.js';

/**
 * Tarefa agendada do cancelamento, chamada pelo cron da Vercel uma vez por
 * dia (`apps/api/vercel.json`).
 */
@Controller('tarefas')
@UseGuards(CronGuard)
export class TarefasCancelamentosController {
  constructor(private readonly cancelamentos: CancelamentosService) {}

  /** Confirma os pedidos sem resposta da sede em 15 dias (RN18). */
  @Get('cancelamentos')
  confirmarSemResposta() {
    return this.cancelamentos.confirmarSemResposta();
  }
}
