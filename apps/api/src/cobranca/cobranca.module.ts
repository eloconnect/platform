import { Module } from '@nestjs/common';
import { AuditoriaModule } from '../auditoria/auditoria.module.js';
import { EmailModule } from '../email/email.module.js';
import { EdicaoBoletoService } from './edicao-boleto.service.js';
import { GatewayPagamento } from './gateway-pagamento.js';
import { GatewaySimulado } from './gateway-simulado.js';
import { LoteMensalService } from './lote-mensal.service.js';
import { TarefasController } from './tarefas.controller.js';
import { TransacoesService } from './transacoes.service.js';

/** Cobrança dos associados (M3). */
@Module({
  imports: [AuditoriaModule, EmailModule],
  controllers: [TarefasController],
  providers: [
    TransacoesService,
    LoteMensalService,
    EdicaoBoletoService,
    // TODO(#40): o adaptador do Sicredi entra aqui quando houver o convênio.
    { provide: GatewayPagamento, useClass: GatewaySimulado },
  ],
  exports: [TransacoesService, GatewayPagamento, EdicaoBoletoService],
})
export class CobrancaModule {}
