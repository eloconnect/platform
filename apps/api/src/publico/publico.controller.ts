import { Controller, Get } from '@nestjs/common';
import type { PaginaInicialResponse } from '@eloconnect/shared';
import { PublicoService } from './publico.service';

@Controller('publico')
export class PublicoController {
  constructor(private readonly publicoService: PublicoService) {}

  @Get('pagina-inicial')
  obterPaginaInicial(): Promise<PaginaInicialResponse> {
    return this.publicoService.obterPaginaInicial();
  }
}
