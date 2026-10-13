import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { EsqueciSenhaDto } from './dto/esqueci-senha.dto';
import { LoginDto } from './dto/login.dto';
import { RedefinirSenhaDto } from './dto/redefinir-senha.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('esqueci-senha')
  @HttpCode(200)
  esqueciSenha(@Body() dto: EsqueciSenhaDto) {
    return this.authService.solicitarRecuperacaoSenha(dto);
  }

  @Post('redefinir-senha')
  @HttpCode(200)
  redefinirSenha(@Body() dto: RedefinirSenhaDto) {
    return this.authService.redefinirSenha(dto);
  }
}
