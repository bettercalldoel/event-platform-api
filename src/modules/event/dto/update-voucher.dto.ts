import { IsDateString, IsInt, IsOptional, IsString, Min, MinLength } from "class-validator";

export class UpdateVoucherDTO {
  @IsOptional()
  @IsString()
  @MinLength(2)
  code?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  discountAmount?: number;

  @IsOptional()
  @IsDateString()
  startAt?: string;

  @IsOptional()
  @IsDateString()
  endAt?: string;

  // boleh null untuk unlimited
  @IsOptional()
  @IsInt()
  @Min(1)
  maxUses?: number | null;
}
