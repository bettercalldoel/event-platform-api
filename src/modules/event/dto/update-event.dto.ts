import { IsBoolean, IsDateString, IsInt, IsOptional, IsString, Min, MinLength } from "class-validator";

export class UpdateEventDTO {
  @IsOptional()
  @IsString()
  @MinLength(3)
  name?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  description?: string;

  @IsOptional()
  @IsDateString()
  startAt?: string;

  @IsOptional()
  @IsDateString()
  endAt?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  totalSeats?: number;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  // ✅ single image field (poster+thumbnail digabung)
  @IsOptional()
  @IsString()
  imageUrl?: string;
}
