import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { StatusSolicitacaoSuporte } from '../generated/prisma/enums';

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

export class NovaConvencaoDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  titulo!: string;

  @IsInt()
  @Min(2000)
  @Max(new Date().getFullYear() + 5)
  ano!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(50000)
  resumo!: string;

  @IsBoolean()
  publicar!: boolean;
}

export class AtualizarConvencaoDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  titulo?: string;

  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(new Date().getFullYear() + 5)
  ano?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50000)
  resumo?: string;

  @IsOptional()
  @IsBoolean()
  publicar?: boolean;
}

export class NovoBeneficioDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  titulo!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  descricao!: string;

  @IsInt()
  @Min(0)
  ordem!: number;
}

export class AtualizarBeneficioDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  titulo?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  descricao?: string;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  ordem?: number;
}

export class AtualizarStatusSuporteDto {
  @IsEnum(StatusSolicitacaoSuporte)
  status!: StatusSolicitacaoSuporte;
}
