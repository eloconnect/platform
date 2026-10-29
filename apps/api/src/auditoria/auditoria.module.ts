import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AuditoriaController } from './auditoria.controller.js';
import { AuditoriaService } from './auditoria.service.js';
import { ConsultaAuditoriaService } from './consulta-auditoria.service.js';

@Module({
  imports: [AuthModule],
  controllers: [AuditoriaController],
  providers: [AuditoriaService, ConsultaAuditoriaService],
  exports: [AuditoriaService],
})
export class AuditoriaModule {}
