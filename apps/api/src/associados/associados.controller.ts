import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UsuarioAtual } from '../auth/decorators/usuario-atual.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { AssociadosService } from './associados.service.js';
import { CriarAssociadoDto, EditarAssociadoDto } from './dto/associado.dto.js';

/** Gestão de associados pela sede (US08, RF08). Só admin. */
@Controller('associados')
@UseGuards(RolesGuard)
@Roles('ADMIN')
export class AssociadosController {
  constructor(private readonly associados: AssociadosService) {}

  @Get(':id')
  buscar(@Param('id', ParseUUIDPipe) id: string) {
    return this.associados.buscar(id);
  }

  @Post()
  criar(@UsuarioAtual() usuarioId: string, @Body() dados: CriarAssociadoDto) {
    return this.associados.criar(usuarioId, dados);
  }

  @Patch(':id')
  editar(
    @UsuarioAtual() usuarioId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dados: EditarAssociadoDto,
  ) {
    return this.associados.editar(usuarioId, id, dados);
  }

  @Post(':id/inativar')
  @HttpCode(200)
  inativar(
    @UsuarioAtual() usuarioId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.associados.inativar(usuarioId, id);
  }

  @Post(':id/reativar')
  @HttpCode(200)
  reativar(
    @UsuarioAtual() usuarioId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.associados.reativar(usuarioId, id);
  }
}
