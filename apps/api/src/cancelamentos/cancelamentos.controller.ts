import {
  Body,
  Controller,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AssociadosService } from '../associados/associados.service.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UsuarioAtual } from '../auth/decorators/usuario-atual.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { CancelamentosService } from './cancelamentos.service.js';
import { DecidirCancelamentoDto } from './dto/decidir-cancelamento.dto.js';

/** Decisão sobre o pedido de cancelamento, só do chave mestre (RF27, RN33). */
@Controller('cancelamentos')
@UseGuards(RolesGuard)
@Roles('ADMIN')
export class CancelamentosController {
  constructor(
    private readonly cancelamentos: CancelamentosService,
    private readonly associados: AssociadosService,
  ) {}

  /** Aprova ou recusa o pedido e devolve o perfil do associado. */
  @Post(':id/decisao')
  @HttpCode(200)
  async decidir(
    @UsuarioAtual() usuarioId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dados: DecidirCancelamentoDto,
  ) {
    const associadoId = await this.cancelamentos.decidir(usuarioId, id, dados);
    return this.associados.buscar(associadoId);
  }
}
