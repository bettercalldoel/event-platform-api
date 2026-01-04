/*
  Warnings:

  - The values [WAITING_FOR_CONFIRMATION,PAID,REJECT] on the enum `TransactionStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `availableSeat` on the `events` table. All the data in the column will be lost.
  - You are about to drop the column `date` on the `events` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `events` table. All the data in the column will be lost.
  - You are about to drop the column `paymentProof` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the `blogs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `products` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `samples` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[couponId]` on the table `transactions` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[referralCode]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `category` to the `events` table without a default value. This is not possible if the table is not empty.
  - Added the required column `description` to the `events` table without a default value. This is not possible if the table is not empty.
  - Added the required column `endAt` to the `events` table without a default value. This is not possible if the table is not empty.
  - Added the required column `location` to the `events` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizerId` to the `events` table without a default value. This is not possible if the table is not empty.
  - Added the required column `remainingSeats` to the `events` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startAt` to the `events` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalSeats` to the `events` table without a default value. This is not possible if the table is not empty.
  - Added the required column `customerId` to the `transactions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `paymentDueAt` to the `transactions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `subtotalAmount` to the `transactions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalAmount` to the `transactions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `referralCode` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CUSTOMER', 'ORGANIZER');

-- CreateEnum
CREATE TYPE "PointReason" AS ENUM ('REFERRAL_REWARD', 'USED_IN_TRANSACTION', 'ROLLBACK', 'EXPIRED', 'ADJUSTMENT');

-- AlterEnum
BEGIN;
CREATE TYPE "TransactionStatus_new" AS ENUM ('WAITING_FOR_PAYMENT', 'WAITING_FOR_ADMIN_CONFIRMATION', 'DONE', 'REJECTED', 'EXPIRED', 'CANCELED');
ALTER TABLE "transactions" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "transactions" ALTER COLUMN "status" TYPE "TransactionStatus_new" USING ("status"::text::"TransactionStatus_new");
ALTER TYPE "TransactionStatus" RENAME TO "TransactionStatus_old";
ALTER TYPE "TransactionStatus_new" RENAME TO "TransactionStatus";
DROP TYPE "TransactionStatus_old";
ALTER TABLE "transactions" ALTER COLUMN "status" SET DEFAULT 'WAITING_FOR_PAYMENT';
COMMIT;

-- DropForeignKey
ALTER TABLE "blogs" DROP CONSTRAINT "blogs_userId_fkey";

-- DropForeignKey
ALTER TABLE "events" DROP CONSTRAINT "events_userId_fkey";

-- DropForeignKey
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_userId_fkey";

-- AlterTable
ALTER TABLE "events" DROP COLUMN "availableSeat",
DROP COLUMN "date",
DROP COLUMN "userId",
ADD COLUMN     "category" TEXT NOT NULL,
ADD COLUMN     "description" TEXT NOT NULL,
ADD COLUMN     "endAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "isPublished" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "location" TEXT NOT NULL,
ADD COLUMN     "organizerId" INTEGER NOT NULL,
ADD COLUMN     "remainingSeats" INTEGER NOT NULL,
ADD COLUMN     "startAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "totalSeats" INTEGER NOT NULL,
ALTER COLUMN "price" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "transactions" DROP COLUMN "paymentProof",
DROP COLUMN "price",
DROP COLUMN "userId",
ADD COLUMN     "couponDiscount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "couponId" INTEGER,
ADD COLUMN     "customerId" INTEGER NOT NULL,
ADD COLUMN     "decidedAt" TIMESTAMP(3),
ADD COLUMN     "decisionDueAt" TIMESTAMP(3),
ADD COLUMN     "paymentDueAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "paymentProofUploadedAt" TIMESTAMP(3),
ADD COLUMN     "paymentProofUrl" TEXT,
ADD COLUMN     "pointsUsed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "subtotalAmount" INTEGER NOT NULL,
ADD COLUMN     "ticketTypeId" INTEGER,
ADD COLUMN     "totalAmount" INTEGER NOT NULL,
ADD COLUMN     "voucherDiscount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "voucherId" INTEGER;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "referralCode" TEXT NOT NULL,
ADD COLUMN     "referredById" INTEGER,
ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'CUSTOMER';

-- DropTable
DROP TABLE "blogs";

-- DropTable
DROP TABLE "products";

-- DropTable
DROP TABLE "samples";

-- CreateTable
CREATE TABLE "ticket_types" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "totalSeats" INTEGER NOT NULL,
    "remainingSeats" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vouchers" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "discountAmount" INTEGER NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "discountAmount" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "point_ledger" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" "PointReason" NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "transactionId" INTEGER,
    "referenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "point_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ticket_types_eventId_idx" ON "ticket_types"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "vouchers_code_key" ON "vouchers"("code");

-- CreateIndex
CREATE INDEX "vouchers_eventId_idx" ON "vouchers"("eventId");

-- CreateIndex
CREATE INDEX "vouchers_startAt_endAt_idx" ON "vouchers"("startAt", "endAt");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");

-- CreateIndex
CREATE INDEX "coupons_userId_idx" ON "coupons"("userId");

-- CreateIndex
CREATE INDEX "coupons_expiresAt_idx" ON "coupons"("expiresAt");

-- CreateIndex
CREATE INDEX "point_ledger_userId_idx" ON "point_ledger"("userId");

-- CreateIndex
CREATE INDEX "point_ledger_expiresAt_idx" ON "point_ledger"("expiresAt");

-- CreateIndex
CREATE INDEX "point_ledger_transactionId_idx" ON "point_ledger"("transactionId");

-- CreateIndex
CREATE INDEX "reviews_eventId_idx" ON "reviews"("eventId");

-- CreateIndex
CREATE INDEX "reviews_userId_idx" ON "reviews"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_eventId_userId_key" ON "reviews"("eventId", "userId");

-- CreateIndex
CREATE INDEX "events_startAt_idx" ON "events"("startAt");

-- CreateIndex
CREATE INDEX "events_category_idx" ON "events"("category");

-- CreateIndex
CREATE INDEX "events_location_idx" ON "events"("location");

-- CreateIndex
CREATE INDEX "events_organizerId_idx" ON "events"("organizerId");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_couponId_key" ON "transactions"("couponId");

-- CreateIndex
CREATE INDEX "transactions_customerId_idx" ON "transactions"("customerId");

-- CreateIndex
CREATE INDEX "transactions_eventId_idx" ON "transactions"("eventId");

-- CreateIndex
CREATE INDEX "transactions_status_idx" ON "transactions"("status");

-- CreateIndex
CREATE INDEX "transactions_paymentDueAt_idx" ON "transactions"("paymentDueAt");

-- CreateIndex
CREATE INDEX "transactions_decisionDueAt_idx" ON "transactions"("decisionDueAt");

-- CreateIndex
CREATE UNIQUE INDEX "users_referralCode_key" ON "users"("referralCode");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_referredById_idx" ON "users"("referredById");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_types" ADD CONSTRAINT "ticket_types_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_ledger" ADD CONSTRAINT "point_ledger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_ticketTypeId_fkey" FOREIGN KEY ("ticketTypeId") REFERENCES "ticket_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "vouchers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
