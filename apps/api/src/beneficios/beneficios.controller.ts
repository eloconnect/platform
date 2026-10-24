import { Controller, Get, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AccessStatusGuard } from '../auth/guards/access-status.guard';
import { RequireFinancialAccess } from '../auth/decorators/require-access.decorator';

@Controller('beneficios')
@UseGuards(RolesGuard, AccessStatusGuard)
export class BeneficiosController {
  @Get()
  @RequireFinancialAccess()
  listarBeneficios() {
    return {
      mensagem: 'Acesso autorizado aos benefícios.',
    };
  }
}
