import {
  LIMITES_COMUNICADO,
  type CriarComunicadoRequest,
} from '@eloconnect/shared';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

const aparar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Comunicado da cobrança formal escrito pela sede (RF29). */
export class CriarComunicadoDto implements CriarComunicadoRequest {
  @Transform(aparar)
  @IsString()
  @IsNotEmpty({ message: 'Escreva o assunto.' })
  @MaxLength(LIMITES_COMUNICADO.assunto)
  assunto!: string;

  @Transform(aparar)
  @IsString()
  @IsNotEmpty({ message: 'Escreva o texto do comunicado.' })
  @MaxLength(LIMITES_COMUNICADO.texto)
  texto!: string;
}
