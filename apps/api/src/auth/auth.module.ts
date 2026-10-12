import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { MailerService } from './mailer.service';
import { RolesGuard } from './roles.guard';
import { SessionGuard } from './session.guard';

@Module({
  controllers: [AuthController],
  providers: [AuthService, MailerService, SessionGuard, RolesGuard],
  exports: [AuthService, MailerService, SessionGuard, RolesGuard],
})
export class AuthModule {}
