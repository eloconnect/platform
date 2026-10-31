import { Module } from '@nestjs/common';
import { GatewayPagamento } from './gateway-pagamento.js';
import { GatewaySimulado } from './gateway-simulado.js';
import { LoteMensalService } from './lote-mensal.service.js';
import { TarefasController } from './tarefas.controller.js';
import { TransacoesService } from './transacoes.service.js';

/** Cobrança dos associados (M3). */
@Module({
  controllers: [TarefasController],
  providers: [
    TransacoesService,
    LoteMensalService,
    // TODO(#40): o adaptador do Sicredi entra aqui quando houver o convênio.
    { provide: GatewayPagamento, useClass: GatewaySimulado },
  ],
  exports: [TransacoesService, GatewayPagamento],
})
export class CobrancaModule {}
