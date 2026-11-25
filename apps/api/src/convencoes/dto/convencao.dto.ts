import type {
  CriarConvencaoRequest,
  EditarConvencaoRequest,
  LinhaReajuste,
} from '@eloconnect/shared';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

const SemEspacosNasPontas = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

/** Valor em reais com ponto e até duas casas: "1050" ou "1050.00". */
const VALOR = /^\d{1,7}(\.\d{1,2})?$/;

/** Uma linha da tabela de reajuste (RF21, P24). */
export class LinhaReajusteDto implements LinhaReajuste {
  @SemEspacosNasPontas()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  funcao!: string;

  @IsString()
  @Matches(VALOR, { message: 'Informe o piso anterior em reais.' })
  pisoAnterior!: string;

  @IsString()
  @Matches(VALOR, { message: 'Informe o piso novo em reais.' })
  pisoNovo!: string;
}

// Até 50 linhas (MAXIMO_LINHAS_REAJUSTE no shared). O número fica aqui
// porque o decorator roda antes de o shared carregar no lint do CI.
const TabelaReajuste = () => (alvo: object, campo: string) => {
  IsOptional()(alvo, campo);
  IsArray()(alvo, campo);
  ArrayMaxSize(50)(alvo, campo);
  ValidateNested({ each: true })(alvo, campo);
  Type(() => LinhaReajusteDto)(alvo, campo);
};

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

  @TabelaReajuste()
  tabelaReajuste?: LinhaReajusteDto[];
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

  @TabelaReajuste()
  tabelaReajuste?: LinhaReajusteDto[];
}
