import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  ParseUUIDPipe,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  CancelamentoDto,
  RecorrenciaDto,
  SolicitarSuporteDto,
} from './portal.dto';
import { Conta, PortalGuard } from './portal.guard';
import type { ContaAssociado } from './portal.guard';
import { PortalService } from './portal.service';

@Controller('associado')
@UseGuards(PortalGuard)
export class PortalController {
  constructor(private readonly portal: PortalService) {}

  @Get('painel')
  painel(@Conta() conta: ContaAssociado) {
    return this.portal.painel(conta);
  }

  @Get('historico')
  historico(@Conta() conta: ContaAssociado) {
    return this.portal.historico(conta);
  }

  @Get('convencoes')
  convencoes(@Conta() conta: ContaAssociado) {
    return this.portal.convencoes(conta);
  }

  @Post('convencoes/:id/inscricao')
  inscreverConvencao(
    @Conta() conta: ContaAssociado,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.portal.inscreverConvencao(conta, id);
  }

  @Get('convencoes/:convencaoId/anexos/:anexoId')
  async anexoConvencao(
    @Param('convencaoId', ParseUUIDPipe) convencaoId: string,
    @Param('anexoId', ParseUUIDPipe) anexoId: string,
    @Res() resposta: Response,
  ) {
    const anexo = await this.portal.anexoConvencao(convencaoId, anexoId);
    resposta.setHeader('Content-Type', 'application/pdf');
    resposta.setHeader('X-Content-Type-Options', 'nosniff');
    resposta.setHeader(
      'Content-Disposition',
      `attachment; filename="convencao.pdf"; filename*=UTF-8''${encodeURIComponent(anexo.nomeArquivo)}`,
    );
    resposta.send(anexo.conteudo);
  }

  @Get('noticias')
  noticias() {
    return this.portal.noticias();
  }

  @Get('beneficios')
  beneficios(@Conta() conta: ContaAssociado) {
    return this.portal.beneficios(conta);
  }

  @Post('suporte')
  solicitarSuporte(
    @Conta() conta: ContaAssociado,
    @Body() dto: SolicitarSuporteDto,
  ) {
    return this.portal.solicitarSuporte(conta, dto.mensagem);
  }

  @Post('recorrencia')
  @HttpCode(200)
  recorrencia(@Conta() conta: ContaAssociado, @Body() dto: RecorrenciaDto) {
    return this.portal.definirRecorrencia(conta, dto.ativo);
  }

  @Post('cancelamento')
  @HttpCode(200)
  cancelamento(@Conta() conta: ContaAssociado, @Body() dto: CancelamentoDto) {
    return this.portal.solicitarCancelamento(conta, dto.motivo);
  }
}
