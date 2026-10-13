import { Controller, Get } from '@nestjs/common';
import { PortalService } from './portal.service';

@Controller('publico')
export class BeneficiosPublicosController {
  constructor(private readonly portal: PortalService) {}

  @Get('beneficios')
  beneficios() {
    return this.portal.beneficiosPublicos();
  }
}
