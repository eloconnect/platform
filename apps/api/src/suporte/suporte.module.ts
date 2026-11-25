import { Module } from '@nestjs/common';
import { AuditoriaModule } from '../auditoria/auditoria.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { BeneficiosModule } from '../beneficios/beneficios.module.js';
import { EmailModule } from '../email/email.module.js';
import {
  AssociadoSuporteController,
  SuporteController,
} from './suporte.controller.js';
import { SuporteService } from './suporte.service.js';

/** Benefícios e suporte para o associado (US25). */
@Module({
  imports: [AuthModule, AuditoriaModule, EmailModule, BeneficiosModule],
  controllers: [AssociadoSuporteController, SuporteController],
  providers: [SuporteService],
})
export class SuporteModule {}
