import type { EnviarSuporteRequest } from '@eloconnect/shared';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

const SemEspacosNasPontas = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

/** Pedido de suporte (RF25). Limites em LIMITES_SUPORTE, no shared. */
export class EnviarSuporteDto implements EnviarSuporteRequest {
  @SemEspacosNasPontas()
  @IsString()
  @IsNotEmpty({ message: 'Informe o assunto.' })
  @MaxLength(120)
  assunto!: string;

  @SemEspacosNasPontas()
  @IsString()
  @IsNotEmpty({ message: 'Escreva a mensagem.' })
  @MaxLength(2000)
  mensagem!: string;
}
