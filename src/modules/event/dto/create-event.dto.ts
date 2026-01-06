import { IsBoolean, IsDateString, IsInt, IsOptional, IsString, Min, MinLength } from "class-validator";

export class CreateEventDTO {
  @IsString()
  @MinLength(3)
  name!: string;

  @IsString()
  category!: string;

  @IsString()
  location!: string;

  @IsString()
  @MinLength(10)
  description!: string;

  @IsDateString()
  startAt!: string;

  @IsDateString()
  endAt!: string;

  // IDR, 0 = free
  @IsInt()
  @Min(0)
  price!: number;

  @IsInt()
  @Min(1)
  totalSeats!: number;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  // ✅ single image field
  @IsOptional()
  @IsString()
  imageUrl?: string;
}
