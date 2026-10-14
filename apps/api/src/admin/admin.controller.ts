import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AdminId } from './admin-id.decorator';
import {
  AcessoDto,
  AtualizarBeneficioDto,
  AtualizarConvencaoDto,
  AtualizarStatusSuporteDto,
  NovoBeneficioDto,
  NovaConvencaoDto,
  NovoValorDto,
} from './admin.dto';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';
import { TAMANHO_MAXIMO_PDF } from './convencao-arquivos';
import { lerAssociadosCsv, TAMANHO_MAXIMO_CSV } from './associados-csv';

interface ArquivoPdfRecebido {
  buffer: Buffer;
  originalname: string;
  size: number;
}

interface ArquivoCsvRecebido {
  buffer: Buffer;
  originalname: string;
}

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('resumo')
  resumo() {
    return this.admin.resumo();
  }

  @Get('associados')
  associados(@Query('busca') busca?: string, @Query('pagina') pagina?: string) {
    const numero = Math.max(1, Math.floor(Number(pagina)) || 1);
    return this.admin.listarAssociados(busca?.slice(0, 100), numero);
  }

  @Get('associados.pdf')
  async exportarListaAssociadosPdf(@Res() resposta: Response) {
    const pdf = await this.admin.exportarListaAssociadosPdf();
    resposta.setHeader('Content-Type', 'application/pdf');
    resposta.setHeader('X-Content-Type-Options', 'nosniff');
    resposta.setHeader('Cache-Control', 'no-store');
    resposta.setHeader(
      'Content-Disposition',
      'attachment; filename="farmacias-associadas.pdf"',
    );
    resposta.send(pdf);
  }

  @Post('associados/importar')
  @UseInterceptors(
    FileInterceptor('arquivo', { limits: { fileSize: TAMANHO_MAXIMO_CSV } }),
  )
  importarAssociados(
    @AdminId() adminId: string,
    @UploadedFile() arquivo?: ArquivoCsvRecebido,
  ) {
    if (!arquivo) {
      throw new BadRequestException('Selecione um arquivo CSV para importar.');
    }
    if (!arquivo.originalname.toLowerCase().endsWith('.csv')) {
      throw new BadRequestException(
        'O arquivo enviado deve ter extensão .csv.',
      );
    }
    return this.admin.importarAssociados(
      adminId,
      lerAssociadosCsv(arquivo.buffer),
    );
  }

  @Get('associados/:id')
  ficha(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.ficha(id);
  }

  @Get('associados/:id/historico.pdf')
  async exportarHistoricoPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() resposta: Response,
  ) {
    const pdf = await this.admin.exportarHistoricoPdf(id);
    resposta.setHeader('Content-Type', 'application/pdf');
    resposta.setHeader('X-Content-Type-Options', 'nosniff');
    resposta.setHeader('Cache-Control', 'no-store');
    resposta.setHeader(
      'Content-Disposition',
      `attachment; filename="historico-${id}.pdf"`,
    );
    resposta.send(pdf);
  }

  @Get('valores')
  valores() {
    return this.admin.valores();
  }

  @Post('valores')
  propor(@AdminId() adminId: string, @Body() dto: NovoValorDto) {
    return this.admin.proporValor(adminId, dto.valorMensal, dto.valorAnual);
  }

  @Post('associados/:id/acesso')
  @HttpCode(200)
  acesso(
    @AdminId() adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AcessoDto,
  ) {
    return this.admin.definirAcesso(adminId, id, dto.bloqueado);
  }

  @Post('cancelamentos/:id/aprovar')
  @HttpCode(200)
  aprovar(@AdminId() adminId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.admin.decidirCancelamento(adminId, id);
  }

  @Get('cancelamentos')
  cancelamentos() {
    return this.admin.cancelamentos();
  }

  @Get('beneficios')
  beneficios() {
    return this.admin.beneficios();
  }

  @Post('beneficios')
  criarBeneficio(@AdminId() adminId: string, @Body() dto: NovoBeneficioDto) {
    return this.admin.criarBeneficio(adminId, dto);
  }

  @Patch('beneficios/:id')
  atualizarBeneficio(
    @AdminId() adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AtualizarBeneficioDto,
  ) {
    return this.admin.atualizarBeneficio(adminId, id, dto);
  }

  @Get('suporte')
  solicitacoesSuporte() {
    return this.admin.solicitacoesSuporte();
  }

  @Patch('suporte/:id')
  atualizarStatusSuporte(
    @AdminId() adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AtualizarStatusSuporteDto,
  ) {
    return this.admin.atualizarStatusSuporte(adminId, id, dto.status);
  }

  @Get('convencoes')
  convencoes() {
    return this.admin.convencoes();
  }

  @Post('convencoes')
  criarConvencao(@AdminId() adminId: string, @Body() dto: NovaConvencaoDto) {
    return this.admin.criarConvencao(adminId, dto);
  }

  @Patch('convencoes/:id')
  atualizarConvencao(
    @AdminId() adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AtualizarConvencaoDto,
  ) {
    return this.admin.atualizarConvencao(adminId, id, dto);
  }

  @Post('convencoes/:id/anexos')
  @UseInterceptors(
    FileInterceptor('arquivo', { limits: { fileSize: TAMANHO_MAXIMO_PDF } }),
  )
  anexarPdf(
    @AdminId() adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() arquivo?: ArquivoPdfRecebido,
  ) {
    if (!arquivo) {
      throw new BadRequestException('Selecione um arquivo PDF para anexar.');
    }
    return this.admin.anexarPdf(adminId, id, arquivo);
  }
}
