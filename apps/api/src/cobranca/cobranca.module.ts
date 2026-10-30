import { Module } from '@nestjs/common';
import { TransacoesService } from './transacoes.service.js';

/** Cobrança dos associados (M3). */
@Module({
  providers: [TransacoesService],
  exports: [TransacoesService],
})
export class CobrancaModule {}
