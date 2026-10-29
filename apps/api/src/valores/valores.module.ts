import { Module } from '@nestjs/common';
import { AuditoriaModule } from '../auditoria/auditoria.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { EmailModule } from '../email/email.module.js';
import { ValoresController } from './valores.controller.js';
import { ValoresService } from './valores.service.js';

@Module({
  imports: [AuthModule, AuditoriaModule, EmailModule],
  controllers: [ValoresController],
  providers: [ValoresService],
})
export class ValoresModule {}
