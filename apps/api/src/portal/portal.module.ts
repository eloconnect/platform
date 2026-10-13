import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PortalController } from './portal.controller';
import { BeneficiosPublicosController } from './beneficios-publicos.controller';
import { PortalGuard } from './portal.guard';
import { PortalService } from './portal.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [PortalController, BeneficiosPublicosController],
  providers: [PortalService, PortalGuard],
})
export class PortalModule {}
