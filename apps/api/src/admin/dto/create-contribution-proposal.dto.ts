import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateContributionProposalDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(1000000)
  annualAmount!: number;

  @IsOptional()
  @IsString()
  note?: string;
}
