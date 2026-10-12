import { IsString, MaxLength, MinLength } from 'class-validator';

export class ResendEmailCodeDto {
  @IsString()
  @MinLength(32)
  @MaxLength(128)
  challengeToken!: string;
}
