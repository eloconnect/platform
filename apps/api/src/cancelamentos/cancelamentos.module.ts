import { Module } from '@nestjs/common';
import { AssociadosModule } from '../associados/associados.module.js';
import { AuditoriaModule } from '../auditoria/auditoria.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { EmailModule } from '../email/email.module.js';
import { AssociadoCancelamentoController } from './associado-cancelamento.controller.js';
import { CancelamentosController } from './cancelamentos.controller.js';
import { CancelamentosService } from './cancelamentos.service.js';
import { TarefasCancelamentosController } from './tarefas-cancelamentos.controller.js';

@Module({
  imports: [AuthModule, AuditoriaModule, EmailModule, AssociadosModule],
  controllers: [
    AssociadoCancelamentoController,
    CancelamentosController,
    TarefasCancelamentosController,
  ],
  providers: [CancelamentosService],
})
export class CancelamentosModule {}
