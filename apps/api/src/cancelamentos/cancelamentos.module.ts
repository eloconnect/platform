import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AssociadoCancelamentoController } from './associado-cancelamento.controller.js';
import { CancelamentosService } from './cancelamentos.service.js';

@Module({
  imports: [AuthModule],
  controllers: [AssociadoCancelamentoController],
  providers: [CancelamentosService],
})
export class CancelamentosModule {}
