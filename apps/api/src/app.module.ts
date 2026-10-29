import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { HealthController } from './health.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { EmailModule } from './email/email.module.js';
import { AssociadosModule } from './associados/associados.module.js';
import { AuditoriaModule } from './auditoria/auditoria.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    EmailModule,
    AssociadosModule,
    AuditoriaModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
