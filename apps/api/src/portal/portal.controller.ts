import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CancelamentoDto, RecorrenciaDto } from './portal.dto';
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
  convencoes() {
    return this.portal.convencoes();
  }

  @Get('noticias')
  noticias() {
    return this.portal.noticias();
  }

  @Get('beneficios')
  beneficios() {
    return this.portal.beneficios();
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
