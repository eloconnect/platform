import { Module } from '@nestjs/common';
import { AuditoriaModule } from '../auditoria/auditoria.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { EmailModule } from '../email/email.module.js';
import { ComunicadosController } from './comunicados.controller.js';
import { ComunicadosService } from './comunicados.service.js';
import { TarefasComunicadosController } from './tarefas-comunicados.controller.js';

@Module({
  imports: [AuthModule, AuditoriaModule, EmailModule],
  controllers: [ComunicadosController, TarefasComunicadosController],
  providers: [ComunicadosService],
})
export class ComunicadosModule {}
