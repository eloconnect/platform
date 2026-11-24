import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UsuarioAtual } from '../auth/decorators/usuario-atual.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { AvulsoService } from './avulso.service.js';

/** Boleto avulso do associado logado (RF37, RN24). */
@Controller('associado/avulso')
@UseGuards(RolesGuard)
@Roles('ASSOCIADO')
export class AssociadoAvulsoController {
  constructor(private readonly avulso: AvulsoService) {}

  @Get()
  situacao(@UsuarioAtual() usuarioId: string) {
    return this.avulso.situacao(usuarioId);
  }

  @Post()
  pedir(@UsuarioAtual() usuarioId: string) {
    return this.avulso.pedir(usuarioId);
  }
}
