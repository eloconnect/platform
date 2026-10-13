import { IsBoolean, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class NovoValorDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(100000)
  valorMensal!: number;

  /** Se omitido, é 12 mensalidades com 20% de desconto (RN13). */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(1000000)
  valorAnual?: number;
}

export class AcessoDto {
  @IsBoolean()
  bloqueado!: boolean;
}
