import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ConventionSalaryScaleDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  jobTitle!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999999)
  floorAmount!: number;
}

export class SaveConventionDto {
  @IsString()
  @MinLength(3)
  @MaxLength(180)
  title!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(10000)
  summary!: string;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string | null;

  @IsOptional()
  @IsDateString()
  effectiveUntil?: string | null;

  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  attachmentFileName?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['https'] })
  attachmentUrl?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ConventionSalaryScaleDto)
  salaryScales?: ConventionSalaryScaleDto[];
}
