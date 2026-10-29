import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UsuarioAtual } from '../auth/decorators/usuario-atual.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { CriarConvencaoDto, EditarConvencaoDto } from './dto/convencao.dto.js';
import { ConvencoesService } from './convencoes.service.js';

const TAMANHO_MAXIMO_PDF = 4 * 1024 * 1024;

@Controller('convencoes')
@UseGuards(RolesGuard)
@Roles('ADMIN', 'ADMIN_BASICO')
export class ConvencoesController {
  constructor(private readonly convencoes: ConvencoesService) {}

  @Get()
  listar() {
    return this.convencoes.listar();
  }

  @Post()
  criar(@UsuarioAtual() usuarioId: string, @Body() dados: CriarConvencaoDto) {
    return this.convencoes.criar(usuarioId, dados);
  }

  @Patch(':id')
  editar(
    @UsuarioAtual() usuarioId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dados: EditarConvencaoDto,
  ) {
    return this.convencoes.editar(usuarioId, id, dados);
  }

  @Post(':id/anexos')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'integral', maxCount: 1 },
        { name: 'resumida', maxCount: 1 },
      ],
      {
        limits: {
          fileSize: TAMANHO_MAXIMO_PDF,
          files: 2,
        },
      },
    ),
  )
  atualizarAnexos(
    @UsuarioAtual() usuarioId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles()
    arquivos: {
      integral?: {
        mimetype: string;
        buffer: Buffer;
        size: number;
        originalname: string;
      }[];
      resumida?: {
        mimetype: string;
        buffer: Buffer;
        size: number;
        originalname: string;
      }[];
    },
  ) {
    const integral = arquivos?.integral?.[0];
    const resumida = arquivos?.resumida?.[0];

    if (!integral && !resumida) {
      throw new BadRequestException(
        'Envie pelo menos um PDF: integral ou resumido.',
      );
    }

    return this.convencoes.atualizarAnexos(usuarioId, id, {
      ...(integral ? { integral } : {}),
      ...(resumida ? { resumida } : {}),
    });
  }

  @Post(':id/publicar')
  publicar(
    @UsuarioAtual() usuarioId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.convencoes.publicar(usuarioId, id);
  }

  @Delete(':id')
  remover(
    @UsuarioAtual() usuarioId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.convencoes.remover(usuarioId, id);
  }
}
