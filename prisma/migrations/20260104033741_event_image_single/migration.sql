/*
  Warnings:

  - You are about to drop the column `posterUrl` on the `events` table. All the data in the column will be lost.
  - You are about to drop the column `thumbnailUrl` on the `events` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "events" DROP COLUMN "posterUrl",
DROP COLUMN "thumbnailUrl",
ADD COLUMN     "imageUrl" TEXT;
