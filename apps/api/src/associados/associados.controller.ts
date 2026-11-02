import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { FormatoExportacao } from '@eloconnect/shared';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UsuarioAtual } from '../auth/decorators/usuario-atual.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { EditarProximoBoletoDto } from '../cobranca/dto/editar-proximo-boleto.dto.js';
import { EdicaoBoletoService } from '../cobranca/edicao-boleto.service.js';
import { HistoricoBoletosService } from '../cobranca/historico-boletos.service.js';
import { AssociadosService } from './associados.service.js';
import { ImportacaoService } from './importacao.service.js';
import { textoDoArquivo } from './planilha.js';
import {
  CriarAssociadoDto,
  DefinirAcessoDto,
  EditarAssociadoDto,
  InterromperCobrancaDto,
} from './dto/associado.dto.js';
import { FiltrosAssociadosDto } from './dto/filtros-associados.dto.js';

/** Cerca de 2.000 farmácias cabem com folga em 1 MB. */
const TAMANHO_MAXIMO_PLANILHA = 1024 * 1024;

/** Formatos da exportação do histórico, no jeito que o ParseEnumPipe lê. */
const FORMATOS = { pdf: 'pdf', csv: 'csv' } satisfies Record<
  FormatoExportacao,
  FormatoExportacao
>;

/** Tipo de arquivo de cada formato. */
const TIPOS: Record<FormatoExportacao, string> = {
  pdf: 'application/pdf',
  csv: 'text/csv; charset=utf-8',
};

/**
 * Gestão de associados pela sede (US06, US07, US08, US09, US11, US32, US35:
 * RF06, RF07, RF08, RF09, RF11, RF32, RF38), com a carga inicial pela
 * planilha (RF42). Só o chave mestre altera; o
 * perfil básico só consulta e exporta (RN33).
 */
@Controller('associados')
@UseGuards(RolesGuard)
@Roles('ADMIN')
export class AssociadosController {
  constructor(
    private readonly associados: AssociadosService,
    private readonly edicoes: EdicaoBoletoService,
    private readonly historico: HistoricoBoletosService,
    private readonly importacao: ImportacaoService,
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

  /**
   * Carga inicial pela planilha modelo, em CSV (RF42). Só o chave mestre,
   * como o cadastro (RN33).
   */
  @Post('importacao')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('planilha', {
      limits: { fileSize: TAMANHO_MAXIMO_PLANILHA, files: 1 },
    }),
  )
  importar(
    @UsuarioAtual() usuarioId: string,
    @UploadedFile() arquivo?: { buffer: Buffer },
  ) {
    if (!arquivo) {
      throw new BadRequestException('Escolha a planilha.');
    }
    return this.importacao.importar(usuarioId, textoDoArquivo(arquivo.buffer));
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

  /** Interrompe a cobrança recorrente, com aviso ao associado (RF38, RN25). */
  @Post(':id/interromper-cobranca')
  @HttpCode(200)
  interromperCobranca(
    @UsuarioAtual() usuarioId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dados: InterromperCobrancaDto,
  ) {
    return this.associados.interromperCobranca(usuarioId, id, dados.motivo);
  }

  /** Histórico de boletos e pagamentos no perfil (RF07). */
  @Get(':id/boletos')
  @Roles('ADMIN', 'ADMIN_BASICO')
  listarBoletos(@Param('id', ParseUUIDPipe) id: string) {
    return this.historico.listar(id);
  }

  /** O mesmo histórico em PDF ou CSV, para comprovar a contribuição (RF32). */
  @Get(':id/boletos/:formato')
  @Roles('ADMIN', 'ADMIN_BASICO')
  @Header('Cache-Control', 'private, no-store')
  async exportarBoletos(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('formato', new ParseEnumPipe(FORMATOS)) formato: FormatoExportacao,
  ): Promise<StreamableFile> {
    const { arquivo, nomeArquivo } = await this.historico.exportar(id, formato);
    return new StreamableFile(arquivo, {
      type: TIPOS[formato],
      disposition: `attachment; filename="${nomeArquivo}"`,
    });
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
