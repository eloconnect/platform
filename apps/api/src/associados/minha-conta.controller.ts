import { Controller, Get, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UsuarioAtual } from '../auth/decorators/usuario-atual.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { AssociadosService } from './associados.service.js';

/** A área do associado: a situação dele e o aviso de liberação (RN11, RN22). */
@Controller('minha-conta')
@UseGuards(RolesGuard)
@Roles('ASSOCIADO')
export class MinhaContaController {
  constructor(private readonly associados: AssociadosService) {}

  @Get()
  ler(@UsuarioAtual() usuarioId: string) {
    return this.associados.minhaConta(usuarioId);
  }
}
