import {
  ACOES_AUDITORIA,
  type AcaoAuditoria,
  type FiltrosLogAuditoria,
} from '@eloconnect/shared';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
} from 'class-validator';

/** Só a data, sem hora: o dia inteiro conta. */
const DIA = /^\d{4}-\d{2}-\d{2}$/;

export class FiltrosLogAuditoriaDto implements FiltrosLogAuditoria {
  @IsOptional()
  @IsUUID()
  usuarioId?: string;

  @IsOptional()
  @IsString()
  associado?: string;

  @IsOptional()
  @IsIn(ACOES_AUDITORIA)
  acao?: AcaoAuditoria;

  @IsOptional()
  @Matches(DIA)
  @IsISO8601({ strict: true })
  de?: string;

  @IsOptional()
  @Matches(DIA)
  @IsISO8601({ strict: true })
  ate?: string;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  pagina?: number;
}
