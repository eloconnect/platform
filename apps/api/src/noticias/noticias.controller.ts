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
import { EditarNoticiaDto, PublicarNoticiaDto } from './dto/noticia.dto.js';
import { NoticiasService } from './noticias.service.js';

/**
 * Notícias (RF35, RF41). Qualquer associado logado lê o feed, em dia ou não
 * (RN28), e a sede também, para conferir; visitante não. Os dois perfis da
 * sede publicam, editam e removem (RN33).
 */
@Controller('noticias')
@UseGuards(RolesGuard)
export class NoticiasController {
  constructor(private readonly noticias: NoticiasService) {}

  @Get()
  @Roles('ASSOCIADO', 'ADMIN', 'ADMIN_BASICO')
  listar() {
    return this.noticias.listar();
  }

  @Post()
  @Roles('ADMIN', 'ADMIN_BASICO')
  publicar(
    @UsuarioAtual() usuarioId: string,
    @Body() dados: PublicarNoticiaDto,
  ) {
    return this.noticias.publicar(usuarioId, dados);
  }

  @Patch(':id')
  @Roles('ADMIN', 'ADMIN_BASICO')
  editar(
    @UsuarioAtual() usuarioId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dados: EditarNoticiaDto,
  ) {
    return this.noticias.editar(usuarioId, id, dados);
  }

  @Delete(':id')
  @Roles('ADMIN', 'ADMIN_BASICO')
  remover(
    @UsuarioAtual() usuarioId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.noticias.remover(usuarioId, id);
  }
}
