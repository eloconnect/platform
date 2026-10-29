import {
  GRUPOS_BENEFICIO,
  type CriarBeneficioRequest,
  type EditarBeneficioRequest,
  type GrupoBeneficio,
} from '@eloconnect/shared';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

/** Tira os espaços das pontas. */
const SemEspacosNasPontas = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

export class CriarBeneficioDto implements CriarBeneficioRequest {
  @SemEspacosNasPontas()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  titulo!: string;

  @SemEspacosNasPontas()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  descricao!: string;

  @IsIn(GRUPOS_BENEFICIO)
  grupo!: GrupoBeneficio;
}

/** Edição: só os campos enviados mudam, e nenhum pode ficar vazio. */
export class EditarBeneficioDto implements EditarBeneficioRequest {
  @ValidateIf((_objeto, valor) => valor !== undefined)
  @SemEspacosNasPontas()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  titulo?: string;

  @ValidateIf((_objeto, valor) => valor !== undefined)
  @SemEspacosNasPontas()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  descricao?: string;

  @ValidateIf((_objeto, valor) => valor !== undefined)
  @IsIn(GRUPOS_BENEFICIO)
  grupo?: GrupoBeneficio;
}
