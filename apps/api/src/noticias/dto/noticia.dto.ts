import type {
  EditarNoticiaRequest,
  PublicarNoticiaRequest,
} from '@eloconnect/shared';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength, ValidateIf } from 'class-validator';

/** Tira os espaços das pontas. */
const SemEspacosNasPontas = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

export class PublicarNoticiaDto implements PublicarNoticiaRequest {
  @SemEspacosNasPontas()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  titulo!: string;

  @SemEspacosNasPontas()
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  conteudo!: string;
}

/** Edição: só os campos enviados mudam, e nenhum pode ficar vazio. */
export class EditarNoticiaDto implements EditarNoticiaRequest {
  @ValidateIf((_objeto, valor) => valor !== undefined)
  @SemEspacosNasPontas()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  titulo?: string;

  @ValidateIf((_objeto, valor) => valor !== undefined)
  @SemEspacosNasPontas()
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  conteudo?: string;
}
