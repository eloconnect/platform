import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { EmailModule } from '../email/email.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RolesGuard } from './guards/roles.guard';
import { AccessStatusGuard } from './guards/access-status.guard';

@Module({
  imports: [JwtModule.register({}), EmailModule],
  controllers: [AuthController],
  providers: [AuthService, RolesGuard, AccessStatusGuard],
  exports: [RolesGuard, AccessStatusGuard],
})
export class AuthModule {}
