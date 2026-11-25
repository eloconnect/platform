import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UsuarioAtual } from '../auth/decorators/usuario-atual.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { AnualService } from './anual.service.js';

/** Plano anual à vista do associado logado (RF17, RN13). */
@Controller('associado/anual')
@UseGuards(RolesGuard)
@Roles('ASSOCIADO')
export class AssociadoAnualController {
  constructor(private readonly anual: AnualService) {}

  @Get()
  situacao(@UsuarioAtual() usuarioId: string) {
    return this.anual.situacao(usuarioId);
  }

  @Post()
  pedir(@UsuarioAtual() usuarioId: string) {
    return this.anual.pedir(usuarioId);
  }
}
