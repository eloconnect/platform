import type {
  FormaPagamento,
  SimularPagamentoRequest,
} from '@eloconnect/shared';
import { IsIn } from 'class-validator';

export class SimularPagamentoDto implements SimularPagamentoRequest {
  @IsIn(['BOLETO', 'PIX'], { message: 'Escolha boleto ou Pix.' })
  formaPagamento!: FormaPagamento;
}
