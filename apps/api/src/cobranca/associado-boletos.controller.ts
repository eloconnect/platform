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
import { BoletosAssociadoService } from './boletos-associado.service.js';

/**
 * Boletos do associado logado (RF12). Em dia ou não, ele vê os boletos em
 * aberto para pagar.
 */
@Controller('associado/boletos')
@UseGuards(RolesGuard)
@Roles('ASSOCIADO')
export class AssociadoBoletosController {
  constructor(private readonly boletos: BoletosAssociadoService) {}

  @Get()
  listar(@UsuarioAtual() usuarioId: string) {
    return this.boletos.listar(usuarioId);
  }

  @Get(':id/pdf')
  @Header('Cache-Control', 'private, no-store')
  async pdf(
    @UsuarioAtual() usuarioId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StreamableFile> {
    const { arquivo, nomeArquivo } = await this.boletos.pdf(usuarioId, id);
    return new StreamableFile(arquivo, {
      type: 'application/pdf',
      disposition: `attachment; filename="${nomeArquivo}"`,
    });
  }
}
