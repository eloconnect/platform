import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class VerifyEmailCodeDto {
  @IsString()
  @MinLength(32)
  @MaxLength(128)
  challengeToken!: string;

  @IsString()
  @Matches(/^\d{6}$/)
  code!: string;

  @IsOptional()
  @IsBoolean()
  rememberMe = false;
}
