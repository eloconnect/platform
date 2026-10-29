import { FORMATO_VALOR, type AlterarValorRequest } from '@eloconnect/shared';
import { Matches } from 'class-validator';

export class AlterarValorDto implements AlterarValorRequest {
  @Matches(FORMATO_VALOR, {
    message: 'Informe o valor em reais, com ponto e duas casas (ex.: 130.00).',
  })
  valorMensal!: string;
}
