import {
  Body,
  Controller,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UsuarioAtual } from '../auth/decorators/usuario-atual.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { SimularPagamentoDto } from './dto/simular-pagamento.dto.js';
import { PagamentosService } from './pagamentos.service.js';

/** Ações da sede sobre um boleto. A cobrança é só do chave mestre (RN33). */
@Controller('boletos')
@UseGuards(RolesGuard)
@Roles('ADMIN')
export class BoletosController {
  constructor(private readonly pagamentos: PagamentosService) {}

  /** Pagamento de mentira, só com o banco simulado (demonstração). */
  @Post(':id/pagamento-simulado')
  @HttpCode(200)
  simularPagamento(
    @UsuarioAtual() usuarioId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dados: SimularPagamentoDto,
  ) {
    return this.pagamentos.simular(usuarioId, id, dados.formaPagamento);
  }
}
