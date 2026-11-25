import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UsuarioAtual } from '../auth/decorators/usuario-atual.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { DecidirQuitacaoDto } from './dto/decidir-quitacao.dto.js';
import { ListarQuitacaoDto } from './dto/listar-quitacao.dto.js';
import { QuitacaoService } from './quitacao.service.js';

/** Boleto dos meses em aberto pedido pelo associado logado (RN30). */
@Controller('associado/meses-em-aberto')
@UseGuards(RolesGuard)
@Roles('ASSOCIADO')
export class AssociadoQuitacaoController {
  constructor(private readonly quitacao: QuitacaoService) {}

  @Get()
  situacao(@UsuarioAtual() usuarioId: string) {
    return this.quitacao.situacao(usuarioId);
  }

  @Post()
  pedir(@UsuarioAtual() usuarioId: string) {
    return this.quitacao.pedir(usuarioId);
  }
}

/** Decisão sobre os pedidos, só do chave mestre (RN30, RN33). */
@Controller('pedidos-quitacao')
@UseGuards(RolesGuard)
@Roles('ADMIN')
export class QuitacaoController {
  constructor(private readonly quitacao: QuitacaoService) {}

  @Get()
  pendentes(@Query() { associadoId }: ListarQuitacaoDto) {
    return this.quitacao.pendentes(associadoId);
  }

  @Post(':id/decisao')
  @HttpCode(200)
  decidir(
    @UsuarioAtual() usuarioId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dados: DecidirQuitacaoDto,
  ) {
    return this.quitacao.decidir(usuarioId, id, dados);
  }
}
