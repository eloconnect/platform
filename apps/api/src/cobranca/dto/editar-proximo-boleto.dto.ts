import {
  FORMATO_VALOR,
  type EditarProximoBoletoRequest,
} from '@eloconnect/shared';
import { Matches } from 'class-validator';

export class EditarProximoBoletoDto implements EditarProximoBoletoRequest {
  @Matches(FORMATO_VALOR, {
    message: 'Informe o valor em reais, com ponto e duas casas (ex.: 130.00).',
  })
  valor!: string;
}
