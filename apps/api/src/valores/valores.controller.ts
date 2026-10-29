import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UsuarioAtual } from '../auth/decorators/usuario-atual.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { AlterarValorDto } from './dto/alterar-valor.dto.js';
import { ValoresService } from './valores.service.js';

/** Painel de valores (US18 a US20). Só o chave mestre (RN20, RN33). */
@Controller('valores')
@UseGuards(RolesGuard)
@Roles('ADMIN')
export class ValoresController {
  constructor(private readonly valores: ValoresService) {}

  @Get()
  painel() {
    return this.valores.painel();
  }

  @Post()
  alterar(@UsuarioAtual() usuarioId: string, @Body() dados: AlterarValorDto) {
    return this.valores.alterar(usuarioId, dados);
  }
}
