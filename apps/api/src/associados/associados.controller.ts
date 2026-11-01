import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UsuarioAtual } from '../auth/decorators/usuario-atual.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { EditarProximoBoletoDto } from '../cobranca/dto/editar-proximo-boleto.dto.js';
import { EdicaoBoletoService } from '../cobranca/edicao-boleto.service.js';
import { AssociadosService } from './associados.service.js';
import {
  CriarAssociadoDto,
  DefinirAcessoDto,
  EditarAssociadoDto,
} from './dto/associado.dto.js';
import { FiltrosAssociadosDto } from './dto/filtros-associados.dto.js';

/**
 * Gestão de associados pela sede (US06, US08, US09, US11: RF06, RF08, RF09,
 * RF11). Só o chave mestre altera; o perfil básico só consulta (RN33).
 */
@Controller('associados')
@UseGuards(RolesGuard)
@Roles('ADMIN')
export class AssociadosController {
  constructor(
    private readonly associados: AssociadosService,
    private readonly edicoes: EdicaoBoletoService,
  ) {}

  @Get()
  @Roles('ADMIN', 'ADMIN_BASICO')
  listar(@Query() filtros: FiltrosAssociadosDto) {
    return this.associados.listar(filtros);
  }

  @Get(':id')
  @Roles('ADMIN', 'ADMIN_BASICO')
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

  @Put(':id/acesso')
  definirAcesso(
    @UsuarioAtual() usuarioId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dados: DefinirAcessoDto,
  ) {
    return this.associados.definirAcesso(usuarioId, id, dados);
  }

  /** Muda o valor do boleto do mês seguinte (RF11, RN04). */
  @Put(':id/proximo-boleto')
  editarProximoBoleto(
    @UsuarioAtual() usuarioId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dados: EditarProximoBoletoDto,
  ) {
    return this.edicoes.editar(usuarioId, id, dados.valor);
  }

  /** Desfaz a edição: o boleto do mês seguinte volta ao valor normal. */
  @Delete(':id/proximo-boleto')
  voltarAoValorNormal(
    @UsuarioAtual() usuarioId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.edicoes.voltarAoNormal(usuarioId, id);
  }
}
