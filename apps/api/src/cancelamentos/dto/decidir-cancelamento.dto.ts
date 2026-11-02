import type { DecidirCancelamentoRequest } from '@eloconnect/shared';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/** Aprovação ou recusa do pedido de cancelamento (RF27). */
export class DecidirCancelamentoDto implements DecidirCancelamentoRequest {
  @IsIn(['APROVADA', 'RECUSADA'])
  decisao!: 'APROVADA' | 'RECUSADA';

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacao?: string;
}
