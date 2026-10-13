import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class RecorrenciaDto {
  @IsBoolean()
  ativo!: boolean;
}

export class CancelamentoDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;
}
