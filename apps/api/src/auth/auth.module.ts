import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { EmailModule } from '../email/email.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { RolesGuard } from './guards/roles.guard.js';
import { AccessStatusGuard } from './guards/access-status.guard.js';

@Module({
  imports: [JwtModule.register({}), EmailModule],
  controllers: [AuthController],
  providers: [AuthService, RolesGuard, AccessStatusGuard],
  exports: [JwtModule, RolesGuard, AccessStatusGuard],
})
export class AuthModule {}
