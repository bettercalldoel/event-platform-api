import { sign } from "jsonwebtoken";
import { BASE_URL_FE } from "../../config/env";
import { ApiError } from "../../utils/api-error";
import { comparePassword, hashPassword } from "../../utils/password";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";
import { ForgotPasswordDTO } from "./dto/forgot-password.dto";
import { LoginDTO } from "./dto/login.dto";
import { RegisterDTO } from "./dto/register.dto";
import { ResetPasswordDTO } from "./dto/reset-password.dto";

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function genCode(len = 8) {
  return Math.random().toString(36).slice(2, 2 + len).toUpperCase();
}

export class AuthService {
  prisma: PrismaService;
  mailService: MailService;

  constructor() {
    this.prisma = new PrismaService();
    this.mailService = new MailService();
  }

  register = async (body: RegisterDTO) => {
    const existing = await this.prisma.user.findFirst({
      where: { email: body.email },
    });

    if (existing) throw new ApiError("email already exist", 400);

    const hashedPassword = await hashPassword(body.password);

    const now = new Date();
    const expiresAt = addMonths(now, 3);

    const couponAmount = Number(process.env.REFERRAL_COUPON_AMOUNT ?? "20000");
    const pointReward = Number(process.env.REFERRAL_POINT_REWARD ?? "10000");

    // generate unique referralCode for new user
    let referralCode = genCode(8);
    for (let i = 0; i < 10; i++) {
      const exists = await this.prisma.user.findFirst({ where: { referralCode } });
      if (!exists) break;
      referralCode = genCode(8);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // validate referral code if provided
      let referrer: { id: number } | null = null;
      if (body.referralCodeUsed) {
        referrer = await tx.user.findFirst({
          where: { referralCode: body.referralCodeUsed },
          select: { id: true },
        });

        if (!referrer) throw new ApiError("Invalid referral code", 400);
      }

      const user = await tx.user.create({
        data: {
          name: body.name,
          email: body.email,
          password: hashedPassword,
          role: (body.role as any) ?? "CUSTOMER",
          referralCode,
          referredById: referrer?.id ?? null,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          referralCode: true,
          referredById: true,
          createdAt: true,
        },
      });

      // referral rewards
      if (referrer) {
        // coupon for new user (3 months)
        await tx.coupon.create({
          data: {
            userId: user.id,
            code: `REF-${genCode(10)}`,
            discountAmount: couponAmount,
            expiresAt,
          },
        });

        // points for referrer (expire 3 months)
        await tx.pointLedger.create({
          data: {
            userId: referrer.id,
            amount: pointReward,
            reason: "REFERRAL_REWARD",
            expiresAt,
            referenceId: String(user.id),
          },
        });
      }

      return user;
    });

    return { message: "register success", user: result };
  };

  login = async (body: LoginDTO) => {
    const user = await this.prisma.user.findFirst({
      where: { email: body.email },
    });

    if (!user) throw new ApiError("Invalid credentials", 400);

    const isPasswordMatch = await comparePassword(body.password, user.password);
    if (!isPasswordMatch) throw new ApiError("Invalid credentials", 400);

    const payload = { id: user.id, role: user.role };
    const accessToken = sign(payload, process.env.JWT_SECRET!, {
      expiresIn: "7d",
    });

    const { password, ...userWithoutPassword } = user;
    return { ...userWithoutPassword, accessToken };
  };

  me = async (authUserId: number) => {
    const user = await this.prisma.user.findUnique({
      where: { id: authUserId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        referralCode: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    if (!user) throw new ApiError("User not found", 404);
    return user;
  };

  forgotPassword = async (body: ForgotPasswordDTO) => {
    const user = await this.prisma.user.findFirst({
      where: { email: body.email },
    });

    if (!user) throw new ApiError("User not found", 404);

    const payload = { id: user.id };
    const accessToken = sign(payload, process.env.JWT_SECRET_RESET!, {
      expiresIn: "15m",
    });

    await this.mailService.sendEmail(body.email, "Forgot Password", "forgot-password", {
      resetUrl: `${BASE_URL_FE}/reset-password/${accessToken}`,
    });

    return { message: "send email success" };
  };

  resetPassword = async (body: ResetPasswordDTO, authUserId: number) => {
    const hashedPassword = await hashPassword(body.password);

    await this.prisma.user.update({
      where: { id: authUserId },
      data: { password: hashedPassword },
    });

    return { message: "reset password success" };
  };
}
