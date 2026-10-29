import { Module } from '@nestjs/common';
import { AuditoriaModule } from '../auditoria/auditoria.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { BeneficiosController } from './beneficios.controller.js';
import { BeneficiosService } from './beneficios.service.js';

@Module({
  imports: [AuthModule, AuditoriaModule],
  controllers: [BeneficiosController],
  providers: [BeneficiosService],
})
export class BeneficiosModule {}
