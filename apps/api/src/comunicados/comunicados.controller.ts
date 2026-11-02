import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UsuarioAtual } from '../auth/decorators/usuario-atual.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { ComunicadosService } from './comunicados.service.js';
import { CriarComunicadoDto } from './dto/criar-comunicado.dto.js';

/** Cobrança formal, só do chave mestre (RF29, RN33). */
@Controller('comunicados')
@UseGuards(RolesGuard)
@Roles('ADMIN')
export class ComunicadosController {
  constructor(private readonly comunicados: ComunicadosService) {}

  @Get()
  painel() {
    return this.comunicados.painel();
  }

  @Post()
  criar(@UsuarioAtual() usuarioId: string, @Body() dados: CriarComunicadoDto) {
    return this.comunicados.criar(usuarioId, dados);
  }
}
