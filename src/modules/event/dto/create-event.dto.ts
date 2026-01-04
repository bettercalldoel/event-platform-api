import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  MinLength,
} from "class-validator";

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

  @IsInt()
  @Min(0)
  price!: number;

  @IsInt()
  @Min(1)
  totalSeats!: number;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  // ✅ gabungan poster/thumbnail
  @IsOptional()
  @IsUrl()
  imageUrl?: string;
}
