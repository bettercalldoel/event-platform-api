import { IsInt, IsOptional, IsString, Min } from "class-validator";

export class CreateTransactionDTO {
  @IsInt()
  @Min(1)
  eventId!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  ticketTypeId?: number;

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
