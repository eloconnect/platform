import { Controller, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UsuarioAtual } from '../auth/decorators/usuario-atual.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { CancelamentosService } from './cancelamentos.service.js';

/**
 * Pedido de cancelamento do boleto mensal pelo associado logado (RF26). Em
 * dia ou não, quem recebe o boleto pode pedir.
 */
@Controller('associado/cancelamento')
@UseGuards(RolesGuard)
@Roles('ASSOCIADO')
export class AssociadoCancelamentoController {
  constructor(private readonly cancelamentos: CancelamentosService) {}

  @Post()
  pedir(@UsuarioAtual() usuarioId: string) {
    return this.cancelamentos.pedir(usuarioId);
  }
}
