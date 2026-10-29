import { Readable } from 'node:stream';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import {
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { TipoAnexoConvencao } from '@eloconnect/shared';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UsuarioAtual } from '../auth/decorators/usuario-atual.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { ConvencoesService } from './convencoes.service.js';

@Controller('associado/convencoes')
@UseGuards(RolesGuard)
@Roles('ASSOCIADO')
export class AssociadosConvencoesController {
  constructor(private readonly convencoes: ConvencoesService) {}

  @Get()
  listar(@UsuarioAtual() usuarioId: string) {
    return this.convencoes.listarParaAssociado(usuarioId);
  }

  @Get(':id/anexos/:tipo')
  @Header('Cache-Control', 'private, no-store')
  async baixarAnexo(
    @UsuarioAtual() usuarioId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('tipo') tipo: string,
  ): Promise<StreamableFile> {
    if (tipo !== 'INTEGRAL' && tipo !== 'RESUMIDA') {
      throw new NotFoundException('Tipo de PDF não encontrado.');
    }

    const arquivo = await this.convencoes.obterAnexoAssociado(
      usuarioId,
      id,
      tipo as TipoAnexoConvencao,
    );

    return new StreamableFile(
      Readable.fromWeb(
        arquivo.stream as unknown as NodeReadableStream<Uint8Array>,
      ),
      {
        type: arquivo.contentType,
        disposition: `attachment; filename="${arquivo.nomeArquivo}"`,
      },
    );
  }
}
