import cron from "node-cron";
import { PrismaService } from "../modules/prisma/prisma.service";

// helper: tambah 3 bulan (tanpa dependency)
function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

type TxLite = {
  id: number;
  customerId: number;
  eventId: number;
  ticketTypeId: number | null;
  qty: number;
  pointsUsed: number;
  voucherId: number | null;
  couponId: number | null;
};

export const initTransactionScheduler = () => {
  const prisma = new PrismaService();

  // setiap 30 detik (boleh ganti jadi "*/1 * * * *" kalau mau per menit)
  cron.schedule("*/30 * * * * *", async () => {
    const now = new Date();

    try {
      await expireWaitingForPayment(prisma, now);
      await cancelWaitingForAdminConfirmation(prisma, now);
    } catch (e) {
      console.error("[CRON] scheduler error:", e);
    }
  });

  console.log("[CRON] Transaction scheduler started");
};

async function expireWaitingForPayment(prisma: PrismaService, now: Date) {
  const targets: TxLite[] = await prisma.transaction.findMany({
    where: {
      status: "WAITING_FOR_PAYMENT",
      paymentDueAt: { lt: now },
      paymentProofUrl: null,
    },
    select: {
      id: true,
      customerId: true,
      eventId: true,
      ticketTypeId: true,
      qty: true,
      pointsUsed: true,
      voucherId: true,
      couponId: true,
    },
  });

  if (targets.length === 0) return;

  for (const trx of targets) {
    await prisma.$transaction(async (tx) => {
      // idempotent: pastikan status masih WAITING_FOR_PAYMENT
      const updated = await tx.transaction.updateMany({
        where: { id: trx.id, status: "WAITING_FOR_PAYMENT", decidedAt: null },
        data: { status: "EXPIRED", decidedAt: now, decisionDueAt: null },
      });

      if (updated.count === 0) return;

      await rollbackResources(tx, trx);
    });
  }

  console.log(`[CRON] expired ${targets.length} transaction(s)`);
}

async function cancelWaitingForAdminConfirmation(prisma: PrismaService, now: Date) {
  const targets: TxLite[] = await prisma.transaction.findMany({
    where: {
      status: "WAITING_FOR_ADMIN_CONFIRMATION",
      decisionDueAt: { lt: now },
    },
    select: {
      id: true,
      customerId: true,
      eventId: true,
      ticketTypeId: true,
      qty: true,
      pointsUsed: true,
      voucherId: true,
      couponId: true,
    },
  });

  if (targets.length === 0) return;

  for (const trx of targets) {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.transaction.updateMany({
        where: { id: trx.id, status: "WAITING_FOR_ADMIN_CONFIRMATION", decidedAt: null },
        data: { status: "CANCELED", decidedAt: now, decisionDueAt: null },
      });

      if (updated.count === 0) return;

      await rollbackResources(tx, trx);
    });
  }

  console.log(`[CRON] canceled ${targets.length} transaction(s)`);
}

async function rollbackResources(tx: any, trx: TxLite) {
  // 1) restore seats ke Event
  await tx.event.update({
    where: { id: trx.eventId },
    data: { remainingSeats: { increment: trx.qty } },
  });

  // 2) restore seats ke TicketType (kalau ada)
  if (trx.ticketTypeId) {
    await tx.ticketType.update({
      where: { id: trx.ticketTypeId },
      data: { remainingSeats: { increment: trx.qty } },
    });
  }

  // 3) rollback voucher usedCount (kalau transaksi pakai voucher)
  if (trx.voucherId) {
    const v = await tx.voucher.findUnique({
      where: { id: trx.voucherId },
      select: { usedCount: true },
    });
    const dec = Math.min(trx.qty, v?.usedCount ?? 0);
    if (dec > 0) {
      await tx.voucher.update({
        where: { id: trx.voucherId },
        data: { usedCount: { decrement: dec } },
      });
    }
  }

  // 4) rollback coupon (biar bisa dipakai lagi)
  if (trx.couponId) {
    await tx.coupon.update({
      where: { id: trx.couponId },
      data: { usedAt: null },
    });

    // lepas relasi coupon dari transaksi (biar coupon bisa dipakai ulang)
    await tx.transaction.update({
      where: { id: trx.id },
      data: {
        couponId: null,
        couponDiscount: 0,
      },
    });
  }

  // 5) rollback points (credit balik)
  if (trx.pointsUsed && trx.pointsUsed > 0) {
    await tx.pointLedger.create({
      data: {
        userId: trx.customerId,
        amount: trx.pointsUsed,
        reason: "ROLLBACK",
        expiresAt: addMonths(new Date(), 3),
        transactionId: trx.id,
      },
    });

    // optional: clear pointsUsed agar tidak dianggap masih terpakai
    await tx.transaction.update({
      where: { id: trx.id },
      data: {
        pointsUsed: 0,
      },
    });
  }
}
