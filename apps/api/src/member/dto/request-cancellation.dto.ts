import { IsBoolean } from 'class-validator';

export class RequestCancellationDto {
  @IsBoolean()
  confirmed!: boolean;
}
