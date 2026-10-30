import { Module } from '@nestjs/common';
import { ArmazenamentoModule } from '../armazenamento/armazenamento.module.js';
import { AuditoriaModule } from '../auditoria/auditoria.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { ConvencoesController } from './convencoes.controller.js';
import { ConvencoesService } from './convencoes.service.js';
import { AssociadosConvencoesController } from './associados-convencoes.controller.js';

@Module({
  imports: [AuthModule, AuditoriaModule, ArmazenamentoModule],
  controllers: [ConvencoesController, AssociadosConvencoesController],
  providers: [ConvencoesService],
  exports: [ConvencoesService],
})
export class ConvencoesModule {}
