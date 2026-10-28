import { Module } from '@nestjs/common';
import { AuditoriaModule } from '../auditoria/auditoria.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { EmailModule } from '../email/email.module.js';
import { AssociadosController } from './associados.controller.js';
import { AssociadosService } from './associados.service.js';
import { MinhaContaController } from './minha-conta.controller.js';

@Module({
  imports: [AuthModule, AuditoriaModule, EmailModule],
  controllers: [AssociadosController, MinhaContaController],
  providers: [AssociadosService],
})
export class AssociadosModule {}
