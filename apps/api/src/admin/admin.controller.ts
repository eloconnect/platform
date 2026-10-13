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
import { AdminId } from './admin-id.decorator';
import { AcessoDto, NovoValorDto } from './admin.dto';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';

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

  @Get('associados/:id')
  ficha(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.ficha(id);
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

  @Get('convencoes')
  convencoes() {
    return this.admin.convencoes();
  }
}
