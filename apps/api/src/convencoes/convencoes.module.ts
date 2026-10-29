import { Module } from '@nestjs/common';
import { AuditoriaModule } from '../auditoria/auditoria.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { ArmazenamentoConvencoesService } from './armazenamento-convencoes.service.js';
import { ConvencoesController } from './convencoes.controller.js';
import { ConvencoesService } from './convencoes.service.js';
import { AssociadosConvencoesController } from './associados-convencoes.controller.js';

@Module({
  imports: [AuthModule, AuditoriaModule],
  controllers: [ConvencoesController, AssociadosConvencoesController],
  providers: [ConvencoesService, ArmazenamentoConvencoesService],
  exports: [ConvencoesService, ArmazenamentoConvencoesService],
})
export class ConvencoesModule {}
