import {
  Controller,
  Get,
  Header,
  Post,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UsuarioAtual } from '../auth/decorators/usuario-atual.decorator.js';
import { RequireFinancialAccess } from '../auth/decorators/require-access.decorator.js';
import { AccessStatusGuard } from '../auth/guards/access-status.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { ConvencoesService } from './convencoes.service.js';
import { InscricoesService } from './inscricoes.service.js';

@Controller('associado/convencoes')
@UseGuards(RolesGuard)
@Roles('ASSOCIADO')
export class AssociadosConvencoesController {
  constructor(
    private readonly convencoes: ConvencoesService,
    private readonly inscricoes: InscricoesService,
  ) {}

  /** Só quem está em dia ou liberado se inscreve (RF23, P05). */
  @Post(':id/inscricao')
  @UseGuards(AccessStatusGuard)
  @RequireFinancialAccess()
  inscrever(
    @UsuarioAtual() usuarioId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.inscricoes.inscrever(usuarioId, id);
  }

  /** O comprovante continua disponível mesmo se a farmácia atrasar depois. */
  @Get(':id/inscricao/comprovante')
  @Header('Cache-Control', 'private, no-store')
  async comprovante(
    @UsuarioAtual() usuarioId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StreamableFile> {
    const { arquivo, nomeArquivo } = await this.inscricoes.comprovante(
      usuarioId,
      id,
    );
    return new StreamableFile(arquivo, {
      type: 'application/pdf',
      disposition: `attachment; filename="${nomeArquivo}"`,
    });
  }

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
      tipo,
    );

    return new StreamableFile(arquivo.stream, {
      type: arquivo.contentType,
      disposition: `attachment; filename="${arquivo.nomeArquivo}"`,
    });
  }
}
