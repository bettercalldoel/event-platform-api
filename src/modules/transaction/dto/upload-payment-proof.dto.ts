import { IsString, MinLength } from "class-validator";

export class UploadPaymentProofDTO {
  @IsString()
  @MinLength(10)
  paymentProofUrl!: string;
}
