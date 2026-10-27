import type { FiltrosAssociados, StatusAssociado } from '@eloconnect/shared';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

const STATUS = [
  'ADIMPLENTE',
  'INADIMPLENTE',
  'CANCELAMENTO_SOLICITADO',
] satisfies StatusAssociado[];

/** Na query string, "true" e "false" chegam como texto. */
const Booleano = () =>
  Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  );

export class FiltrosAssociadosDto implements FiltrosAssociados {
  @IsOptional()
  @IsString()
  busca?: string;

  @IsOptional()
  @IsIn(STATUS)
  status?: StatusAssociado;

  @Booleano()
  @IsOptional()
  @IsBoolean()
  contribuicaoAtiva?: boolean;

  @Booleano()
  @IsOptional()
  @IsBoolean()
  incluirInativos?: boolean;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  pagina?: number;
}
