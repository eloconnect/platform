import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailCodeDto } from './dto/verify-email-code.dto';
import { ResendEmailCodeDto } from './dto/resend-email-code.dto';
import { AUTH_COOKIE_NAME } from './auth.constants';
import type { AuthRequest } from './auth.types';
import { AuthService } from './auth.service';
import { SessionGuard } from './session.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.ACCEPTED)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('email/verify')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async verifyEmailCode(
    @Body() dto: VerifyEmailCodeDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.verifyEmailCode(dto);
    if (result.purpose === 'REGISTRATION') {
      return {
        purpose: result.purpose,
        message: result.message,
      };
    }
    this.setSessionCookie(response, result.sessionToken, result.cookieMaxAge);
    return { purpose: result.purpose, user: result.user };
  }

  @Post('email/resend')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  resendEmailCode(@Body() dto: ResendEmailCodeDto) {
    return this.authService.resendEmailOtp(dto.challengeToken);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(
      dto.email,
      dto.password,
      dto.rememberMe,
    );
    if (result.requiresTwoFactor) {
      return result;
    }
    this.setSessionCookie(response, result.sessionToken, result.cookieMaxAge);
    return { user: result.user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Header('Cache-Control', 'no-store')
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.logout(request.cookies?.[AUTH_COOKIE_NAME]);
    this.clearSessionCookie(response);
  }

  @Get('me')
  @UseGuards(SessionGuard)
  @Header('Cache-Control', 'no-store')
  getCurrentUser(@Req() request: AuthRequest) {
    return { user: request.authUser };
  }

  @Post('password/forgot')
  @HttpCode(HttpStatus.ACCEPTED)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  async requestPasswordReset(
    @Body() dto: RequestPasswordResetDto,
  ): Promise<{ message: string }> {
    await this.authService.requestPasswordReset(dto.email);
    return {
      message:
        'Se o e-mail estiver associado a uma conta, você receberá as instruções de recuperação.',
    };
  }

  @Post('password/reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.resetPassword(dto.token, dto.password);
    this.clearSessionCookie(response);
  }

  private clearSessionCookie(response: Response): void {
    const options = {
      httpOnly: true,
      secure: this.isSecureCookie(),
      sameSite: 'strict',
    } as const;
    response.clearCookie(AUTH_COOKIE_NAME, { ...options, path: '/api' });
    response.clearCookie(AUTH_COOKIE_NAME, {
      ...options,
      path: '/api/auth',
    });
  }

  private setSessionCookie(
    response: Response,
    sessionToken: string,
    maxAge?: number,
  ): void {
    response.cookie(AUTH_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: this.isSecureCookie(),
      sameSite: 'strict',
      path: '/api',
      ...(maxAge ? { maxAge } : {}),
    });
  }

  private isSecureCookie(): boolean {
    return (
      this.config.get<string>('NODE_ENV') === 'production' ||
      this.config.get<string>('COOKIE_SECURE') === 'true'
    );
  }
}
