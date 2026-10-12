import { IsEmail, MaxLength } from 'class-validator';

export class ResendRegistrationCodeDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;
}
