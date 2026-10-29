import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UsuarioAtual } from '../auth/decorators/usuario-atual.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { BeneficiosService } from './beneficios.service.js';
import { CriarBeneficioDto, EditarBeneficioDto } from './dto/beneficio.dto.js';

/**
 * Benefícios (US24, RF24). A lista é pública, porque a página inicial mostra
 * os benefícios. Os dois perfis da sede cadastram, editam e removem (RN33).
 */
@Controller('beneficios')
export class BeneficiosController {
  constructor(private readonly beneficios: BeneficiosService) {}

  @Get()
  listar() {
    return this.beneficios.listar();
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'ADMIN_BASICO')
  criar(@UsuarioAtual() usuarioId: string, @Body() dados: CriarBeneficioDto) {
    return this.beneficios.criar(usuarioId, dados);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'ADMIN_BASICO')
  editar(
    @UsuarioAtual() usuarioId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dados: EditarBeneficioDto,
  ) {
    return this.beneficios.editar(usuarioId, id, dados);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'ADMIN_BASICO')
  remover(
    @UsuarioAtual() usuarioId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.beneficios.remover(usuarioId, id);
  }
}
