import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { ConsultaAuditoriaService } from './consulta-auditoria.service.js';
import { FiltrosLogAuditoriaDto } from './dto/filtros-log-auditoria.dto.js';

/** Consulta do log de auditoria (US37, RF40). Só o chave mestre vê (RN33). */
@Controller('auditoria')
@UseGuards(RolesGuard)
@Roles('ADMIN')
export class AuditoriaController {
  constructor(private readonly consulta: ConsultaAuditoriaService) {}

  @Get()
  listar(@Query() filtros: FiltrosLogAuditoriaDto) {
    return this.consulta.listar(filtros);
  }

  @Get('usuarios')
  usuarios() {
    return this.consulta.usuarios();
  }
}
