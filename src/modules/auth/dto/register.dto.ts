import { IsEmail, IsIn, IsOptional, IsString, MinLength } from "class-validator";

export class RegisterDTO {
  @IsString()
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsOptional()
  @IsIn(["CUSTOMER", "ORGANIZER"])
  role?: "CUSTOMER" | "ORGANIZER";

  @IsOptional()
  @IsString()
  referralCodeUsed?: string;
}
