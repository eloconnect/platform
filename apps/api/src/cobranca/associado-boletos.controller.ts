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
 * Boletos do associado logado. Em dia ou não, ele vê os boletos em aberto
 * para pagar (RF12) e o histórico de boletos e pagamentos (RF31).
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

  @Get('historico')
  historico(@UsuarioAtual() usuarioId: string) {
    return this.boletos.historico(usuarioId);
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
