import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(3)
  @MaxLength(180)
  legalName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  tradeName?: string;

  @IsString()
  @MinLength(14)
  @MaxLength(18)
  @Matches(/^[\d./\-\s]+$/)
  cnpj!: string;

  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;
}
