import type { AderirRequest } from '@eloconnect/shared';
import { IsNotEmpty, IsString } from 'class-validator';

export class AderirDto implements AderirRequest {
  @IsString()
  @IsNotEmpty()
  versaoTermo!: string;
}
