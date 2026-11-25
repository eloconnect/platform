import type { DecidirQuitacaoRequest } from '@eloconnect/shared';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/** Aprovação ou recusa do boleto dos meses em aberto (RN30). */
export class DecidirQuitacaoDto implements DecidirQuitacaoRequest {
  @IsIn(['APROVADO', 'RECUSADO'])
  decisao!: 'APROVADO' | 'RECUSADO';

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacao?: string;
}
