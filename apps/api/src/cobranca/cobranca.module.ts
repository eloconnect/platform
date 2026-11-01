import { Module } from '@nestjs/common';
import { AuditoriaModule } from '../auditoria/auditoria.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { EmailModule } from '../email/email.module.js';
import { AssociadoBoletosController } from './associado-boletos.controller.js';
import { BloqueioService } from './bloqueio.service.js';
import { BoletosController } from './boletos.controller.js';
import { BoletosAssociadoService } from './boletos-associado.service.js';
import { EdicaoBoletoService } from './edicao-boleto.service.js';
import { EmailBoletoService } from './email-boleto.service.js';
import { GatewayPagamento } from './gateway-pagamento.js';
import { GatewaySimulado } from './gateway-simulado.js';
import { LoteMensalService } from './lote-mensal.service.js';
import { PagamentosService } from './pagamentos.service.js';
import { TarefasController } from './tarefas.controller.js';
import { TransacoesService } from './transacoes.service.js';

/** Cobrança dos associados (M3). */
@Module({
  imports: [AuthModule, AuditoriaModule, EmailModule],
  controllers: [
    TarefasController,
    AssociadoBoletosController,
    BoletosController,
  ],
  providers: [
    TransacoesService,
    LoteMensalService,
    EdicaoBoletoService,
    EmailBoletoService,
    BoletosAssociadoService,
    BloqueioService,
    PagamentosService,
    // TODO(#40): o adaptador do Sicredi entra aqui quando houver o convênio.
    { provide: GatewayPagamento, useClass: GatewaySimulado },
  ],
  exports: [
    TransacoesService,
    GatewayPagamento,
    EdicaoBoletoService,
    PagamentosService,
  ],
})
export class CobrancaModule {}
