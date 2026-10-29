import { Module } from '@nestjs/common';
import { AuditoriaModule } from '../auditoria/auditoria.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { NoticiasController } from './noticias.controller.js';
import { NoticiasService } from './noticias.service.js';

@Module({
  imports: [AuthModule, AuditoriaModule],
  controllers: [NoticiasController],
  providers: [NoticiasService],
})
export class NoticiasModule {}
