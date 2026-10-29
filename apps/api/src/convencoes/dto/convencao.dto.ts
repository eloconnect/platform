import type {
  CriarConvencaoRequest,
  EditarConvencaoRequest,
} from '@eloconnect/shared';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

const SemEspacosNasPontas = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

export class CriarConvencaoDto implements CriarConvencaoRequest {
  @SemEspacosNasPontas()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  titulo!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2200)
  ano!: number;

  @SemEspacosNasPontas()
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  resumo!: string;
}

export class EditarConvencaoDto implements EditarConvencaoRequest {
  @ValidateIf((_objeto, valor) => valor !== undefined)
  @SemEspacosNasPontas()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  titulo?: string;

  @ValidateIf((_objeto, valor) => valor !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2200)
  ano?: number;

  @ValidateIf((_objeto, valor) => valor !== undefined)
  @SemEspacosNasPontas()
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  resumo?: string;
}
