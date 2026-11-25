import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { RequireFinancialAccess } from '../auth/decorators/require-access.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UsuarioAtual } from '../auth/decorators/usuario-atual.decorator.js';
import { AccessStatusGuard } from '../auth/guards/access-status.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { EnviarSuporteDto } from './dto/enviar-suporte.dto.js';
import { SuporteService } from './suporte.service.js';

/**
 * Benefícios e suporte do associado logado (RF25). Em dia ou não, ele vê os
 * benefícios; o suporte é só para quem está em dia ou liberado (RN09, RN11).
 */
@Controller('associado')
@UseGuards(RolesGuard)
@Roles('ASSOCIADO')
export class AssociadoSuporteController {
  constructor(private readonly suporte: SuporteService) {}

  @Get('beneficios')
  beneficios(@UsuarioAtual() usuarioId: string) {
    return this.suporte.meusBeneficios(usuarioId);
  }

  @Post('suporte')
  @UseGuards(AccessStatusGuard)
  @RequireFinancialAccess()
  enviar(@UsuarioAtual() usuarioId: string, @Body() dados: EnviarSuporteDto) {
    return this.suporte.enviar(usuarioId, dados);
  }
}

/** Pedidos de suporte, para os dois perfis da sede. */
@Controller('suporte')
@UseGuards(RolesGuard)
@Roles('ADMIN', 'ADMIN_BASICO')
export class SuporteController {
  constructor(private readonly suporte: SuporteService) {}

  @Get()
  listar() {
    return this.suporte.listar();
  }

  @Post(':id/respondido')
  @HttpCode(200)
  marcarRespondido(
    @UsuarioAtual() usuarioId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.suporte.marcarRespondido(usuarioId, id);
  }
}
