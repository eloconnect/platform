import { Module } from '@nestjs/common';
import { AuditoriaModule } from '../auditoria/auditoria.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { AssociadosController } from './associados.controller.js';
import { AssociadosService } from './associados.service.js';

@Module({
  imports: [AuthModule, AuditoriaModule],
  controllers: [AssociadosController],
  providers: [AssociadosService],
})
export class AssociadosModule {}
