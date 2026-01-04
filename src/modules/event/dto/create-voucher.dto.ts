import { IsDateString, IsInt, IsOptional, IsString, Min, MinLength } from "class-validator";

export class CreateVoucherDTO {
  @IsString()
  @MinLength(3)
  code!: string;

  @IsInt()
  @Min(1)
  discountAmount!: number; // IDR

  @IsDateString()
  startAt!: string;

  @IsDateString()
  endAt!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxUses?: number;
}
