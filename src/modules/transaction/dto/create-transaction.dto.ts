import { IsInt, IsOptional, IsPositive, IsString, Min } from "class-validator";

export class CreateTransactionDTO {
  @IsInt()
  @IsPositive()
  eventId!: number;

  @IsInt()
  @Min(1)
  qty!: number;

  @IsOptional()
  @IsString()
  voucherCode?: string;

  @IsOptional()
  @IsString()
  couponCode?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  pointsUsed?: number;
}
