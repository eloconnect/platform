import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UsuarioAtual } from '../auth/decorators/usuario-atual.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { AdesaoService } from './adesao.service.js';
import { AderirDto } from './dto/aderir.dto.js';

/**
 * Adesão à cobrança recorrente pelo associado logado (RF36, RN23). Em dia ou
 * não, ele pode aderir.
 */
@Controller('associado/adesao')
@UseGuards(RolesGuard)
@Roles('ASSOCIADO')
export class AssociadoAdesaoController {
  constructor(private readonly adesao: AdesaoService) {}

  @Get()
  situacao(@UsuarioAtual() usuarioId: string) {
    return this.adesao.situacao(usuarioId);
  }

  @Post()
  aderir(@UsuarioAtual() usuarioId: string, @Body() dados: AderirDto) {
    return this.adesao.aderir(usuarioId, dados.versaoTermo);
  }
}
