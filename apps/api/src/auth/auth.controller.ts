import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { ConfirmarContaDto } from './dto/confirmar-conta.dto.js';
import { CriarContaDto } from './dto/criar-conta.dto.js';
import { EsqueciSenhaDto } from './dto/esqueci-senha.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RedefinirSenhaDto } from './dto/redefinir-senha.dto.js';

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

  @Post('criar-conta')
  @HttpCode(200)
  criarConta(@Body() dto: CriarContaDto) {
    return this.authService.solicitarCriacaoConta(dto);
  }

  @Post('confirmar-conta')
  @HttpCode(200)
  confirmarConta(@Body() dto: ConfirmarContaDto) {
    return this.authService.confirmarConta(dto);
  }
}
