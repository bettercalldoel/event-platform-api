import cron from "node-cron";
import { PrismaService } from "../modules/prisma/prisma.service";

export const checkExpiredTransactionScheduler = () => {
  const prisma = new PrismaService();

  // jalan setiap 30 detik
  cron.schedule("*/30 * * * * *", async () => {
    console.log("[CRON] Checking expired transactions...");

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    // 1. ambil transaksi WAITING_FOR_PAYMENT yang sudah lewat 2 jam
    const expiredTransactions = await prisma.transaction.findMany({
      where: {
        status: "WAITING_FOR_PAYMENT",
        createdAt: {
          lt: twoHoursAgo,
        },
      },
    });

    if (expiredTransactions.length === 0) {
      return;
    }

    // 2. proses satu per satu (dibungkus transaction per item)
    for (const trx of expiredTransactions) {
      await prisma.$transaction(async (tx) => {
        // 3. update status transaksi jadi EXPIRED
        await tx.transaction.update({
          where: { id: trx.id },
          data: {
            status: "EXPIRED",
          },
        });

        // 4. kembalikan seat ke event
        await tx.event.update({
          where: { id: trx.eventId },
          data: {
            availableSeat: {
              increment: trx.qty,
            },
          },
        });
      });
    }

    console.log(`[CRON] ${expiredTransactions.length} transaction(s) expired`);
  });
};
