import {
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UsuarioAtual } from '../auth/decorators/usuario-atual.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { FiliaisService } from './filiais.service.js';

/** Filiais da matriz logada (RF43, RN31). */
@Controller('associado/filiais')
@UseGuards(RolesGuard)
@Roles('ASSOCIADO')
export class AssociadoFiliaisController {
  constructor(private readonly filiais: FiliaisService) {}

  @Get()
  listar(@UsuarioAtual() usuarioId: string) {
    return this.filiais.listar(usuarioId);
  }

  @Get(':filialId/boletos/:boletoId/pdf')
  @Header('Cache-Control', 'private, no-store')
  async pdf(
    @UsuarioAtual() usuarioId: string,
    @Param('filialId', ParseUUIDPipe) filialId: string,
    @Param('boletoId', ParseUUIDPipe) boletoId: string,
  ): Promise<StreamableFile> {
    const { arquivo, nomeArquivo } = await this.filiais.pdf(
      usuarioId,
      filialId,
      boletoId,
    );
    return new StreamableFile(arquivo, {
      type: 'application/pdf',
      disposition: `attachment; filename="${nomeArquivo}"`,
    });
  }
}
