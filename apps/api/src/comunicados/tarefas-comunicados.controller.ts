import { Controller, Get, UseGuards } from '@nestjs/common';
import { CronGuard } from '../auth/guards/cron.guard.js';
import { ComunicadosService } from './comunicados.service.js';

/**
 * Tarefa agendada da cobrança formal, chamada pelo cron da Vercel uma vez por
 * dia (`apps/api/vercel.json`).
 */
@Controller('tarefas')
@UseGuards(CronGuard)
export class TarefasComunicadosController {
  constructor(private readonly comunicados: ComunicadosService) {}

  /** Manda a parte do dia dos e-mails do comunicado (RNF09). */
  @Get('comunicados')
  enviarDoDia() {
    return this.comunicados.enviarDoDia();
  }
}
