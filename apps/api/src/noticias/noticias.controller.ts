import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TAMANHO_MAXIMO_IMAGEM_NOTICIA } from '@eloconnect/shared';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UsuarioAtual } from '../auth/decorators/usuario-atual.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import {
  EditarNoticiaDto,
  ImagemNoticiaDto,
  PublicarNoticiaDto,
} from './dto/noticia.dto.js';
import { type ArquivoImagem, NoticiasService } from './noticias.service.js';

/**
 * Notícias (RF35, RF41). Qualquer associado logado lê o feed, em dia ou não
 * (RN28), e a sede também, para conferir; visitante não. Os dois perfis da
 * sede publicam, editam e removem, inclusive a imagem (RN33).
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

  /**
   * Põe ou troca a imagem (campo `imagem`) e a descrição dela (campo
   * `descricao`). Uma imagem por envio, porque a Vercel aceita no máximo
   * 4,5 MB por requisição.
   */
  @Post(':id/imagem')
  @Roles('ADMIN', 'ADMIN_BASICO')
  @UseInterceptors(
    FileInterceptor('imagem', {
      limits: { fileSize: TAMANHO_MAXIMO_IMAGEM_NOTICIA, files: 1 },
      // Nomes de arquivo com acento chegam certos.
      defParamCharset: 'utf8',
    }),
  )
  definirImagem(
    @UsuarioAtual() usuarioId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() { descricao }: ImagemNoticiaDto,
    @UploadedFile() arquivo?: ArquivoImagem,
  ) {
    return this.noticias.definirImagem(usuarioId, id, arquivo, descricao);
  }

  @Delete(':id/imagem')
  @Roles('ADMIN', 'ADMIN_BASICO')
  removerImagem(
    @UsuarioAtual() usuarioId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.noticias.removerImagem(usuarioId, id);
  }

  /** Quem lê o feed abre a imagem; ela não tem endereço público. */
  @Get(':id/imagem')
  @Roles('ASSOCIADO', 'ADMIN', 'ADMIN_BASICO')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  async baixarImagem(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StreamableFile> {
    const imagem = await this.noticias.obterImagem(id);
    return new StreamableFile(imagem.stream, {
      type: imagem.contentType,
      disposition: 'inline',
    });
  }
}
