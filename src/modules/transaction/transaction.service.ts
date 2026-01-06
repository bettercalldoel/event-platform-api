import { PrismaService } from "../prisma/prisma.service";
import { ApiError } from "../../utils/api-error";
import { PointReason, TransactionStatus } from "@prisma/client";
import { MailService } from "../mail/mail.service";

function addHours(d: Date, hours: number) {
  return new Date(d.getTime() + hours * 60 * 60 * 1000);
}
function addDays(d: Date, days: number) {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}
function addMonths(d: Date, months: number) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + months);
  return x;
}

export class TransactionService {
  prisma: PrismaService;
  mail: MailService;

  constructor() {
    this.prisma = new PrismaService();
    this.mail = new MailService();
  }

  private calcAvailablePoints = async (userId: number) => {
    const now = new Date();
    const rows = await this.prisma.pointLedger.findMany({
      where: {
        userId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: { amount: true },
    });
    return rows.reduce((acc, r) => acc + r.amount, 0);
  };

  myTransactions = async (customerId: number) => {
    const items = await this.prisma.transaction.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        qty: true,
        subtotalAmount: true,
        voucherDiscount: true,
        couponDiscount: true,
        pointsUsed: true,
        totalAmount: true,
        paymentProofUrl: true,
        paymentProofUploadedAt: true,
        paymentDueAt: true,
        decisionDueAt: true,
        decidedAt: true,
        createdAt: true,
        event: {
          select: { id: true, name: true, startAt: true, location: true, imageUrl: true },
        },
      },
    });

    return { items };
  };

  create = async (body: any, customerId: number) => {
    const now = new Date();

    const eventId = Number(body.eventId);
    const qty = Number(body.qty);
    if (!eventId || Number.isNaN(eventId)) throw new ApiError("Invalid eventId", 400);
    if (!qty || qty < 1) throw new ApiError("qty must be >= 1", 400);

    const voucherCode = body.voucherCode ? String(body.voucherCode).trim() : "";
    const couponCode = body.couponCode ? String(body.couponCode).trim() : "";
    const pointsReq = body.pointsUsed !== undefined ? Number(body.pointsUsed) : 0;
    if (pointsReq < 0) throw new ApiError("pointsUsed must be >= 0", 400);

    return await this.prisma.$transaction(async (tx) => {
      // 1) reserve seats (atomic)
      const eventUpdate = await tx.event.updateMany({
        where: { id: eventId, isPublished: true, remainingSeats: { gte: qty } },
        data: { remainingSeats: { decrement: qty } },
      });
      if (eventUpdate.count === 0) {
        throw new ApiError("Event not found / not published / seats not enough", 400);
      }

      const event = await tx.event.findUnique({
        where: { id: eventId },
        select: { id: true, name: true, price: true, organizerId: true },
      });
      if (!event) throw new ApiError("Event not found", 404);

      const basePrice = event.price;
      const subtotal = basePrice * qty;

      // 2) voucher (optional)
      let voucherId: number | null = null;
      let voucherDiscount = 0;

      if (voucherCode) {
        const v = await tx.voucher.findFirst({
          where: {
            eventId,
            code: voucherCode,
            startAt: { lte: now },
            endAt: { gte: now },
          },
          select: { id: true, discountAmount: true, maxUses: true, usedCount: true },
        });
        if (!v) throw new ApiError("Voucher not found / not active", 400);

        if (v.maxUses !== null) {
          const upd = await tx.voucher.updateMany({
            where: { id: v.id, usedCount: { lt: v.maxUses } },
            data: { usedCount: { increment: 1 } },
          });
          if (upd.count === 0) throw new ApiError("Voucher max uses reached", 400);
        } else {
          await tx.voucher.update({ where: { id: v.id }, data: { usedCount: { increment: 1 } } });
        }

        voucherId = v.id;
        voucherDiscount = Math.min(subtotal, v.discountAmount);
      }

      // 3) coupon (optional)
      let couponId: number | null = null;
      let couponDiscount = 0;

      if (couponCode) {
        const c = await tx.coupon.findFirst({
          where: {
            userId: customerId,
            code: couponCode,
            usedAt: null,
            expiresAt: { gt: now },
          },
          select: { id: true, discountAmount: true },
        });
        if (!c) throw new ApiError("Coupon not found / expired / already used", 400);

        couponId = c.id;
        const afterVoucher = Math.max(0, subtotal - voucherDiscount);
        couponDiscount = Math.min(afterVoucher, c.discountAmount);

        await tx.coupon.update({
          where: { id: c.id },
          data: { usedAt: now },
        });
      }

      // 4) points (optional)
      const afterDiscount = Math.max(0, subtotal - voucherDiscount - couponDiscount);

      let pointsUsed = 0;
      if (pointsReq > 0) {
        const available = await this.calcAvailablePoints(customerId);
        if (pointsReq > available) throw new ApiError(`Points not enough. Available: ${available}`, 400);
        pointsUsed = Math.min(pointsReq, afterDiscount);
      }

      const total = Math.max(0, afterDiscount - pointsUsed);

      // 5) create transaction
      const status = total === 0 ? TransactionStatus.DONE : TransactionStatus.WAITING_FOR_PAYMENT;
      const paymentDueAt = total === 0 ? now : addHours(now, 2);

      const created = await tx.transaction.create({
        data: {
          customerId,
          eventId,
          qty,
          subtotalAmount: subtotal,
          voucherId,
          voucherDiscount,
          couponId,
          couponDiscount,
          pointsUsed,
          totalAmount: total,
          status,
          paymentDueAt,
          decidedAt: total === 0 ? now : null,
        },
        select: {
          id: true,
          status: true,
          paymentDueAt: true,
          totalAmount: true,
        },
      });

      // 6) write point ledger (debit) if points used
      if (pointsUsed > 0) {
        await tx.pointLedger.create({
          data: {
            userId: customerId,
            amount: -pointsUsed,
            reason: PointReason.USED_IN_TRANSACTION,
            expiresAt: null,
            transactionId: created.id,
          },
        });
      }

      return {
        message: "transaction created",
        transaction: created,
      };
    });
  };

  uploadPaymentProof = async (trxId: number, customerId: number, body: any) => {
    const now = new Date();
    const url = String(body.paymentProofUrl || "").trim();
    if (!url) throw new ApiError("paymentProofUrl is required", 400);

    return await this.prisma.$transaction(async (tx) => {
      const trx = await tx.transaction.findUnique({
        where: { id: trxId },
        select: {
          id: true,
          customerId: true,
          status: true,
          totalAmount: true,
          paymentDueAt: true,
        },
      });
      if (!trx) throw new ApiError("Transaction not found", 404);
      if (trx.customerId !== customerId) throw new ApiError("Forbidden", 403);

      if (trx.totalAmount === 0) throw new ApiError("Free transaction does not require payment proof", 400);
      if (trx.status !== TransactionStatus.WAITING_FOR_PAYMENT) {
        throw new ApiError("Transaction is not waiting for payment", 400);
      }

      if (now > trx.paymentDueAt) {
        await this.rollbackTx(tx, trxId, TransactionStatus.EXPIRED, "PAYMENT_TIMEOUT");
        throw new ApiError("Payment due already passed. Transaction expired.", 400);
      }

      await tx.transaction.update({
        where: { id: trxId },
        data: {
          paymentProofUrl: url,
          paymentProofUploadedAt: now,
          decisionDueAt: addDays(now, 3),
          status: TransactionStatus.WAITING_FOR_ADMIN_CONFIRMATION,
        },
      });

      return { message: "payment proof uploaded" };
    });
  };

  accept = async (trxId: number, organizerId: number) => {
    const now = new Date();

    // update status dulu (biar email gagal gak bikin status gagal)
    const trx = await this.prisma.transaction.findUnique({
      where: { id: trxId },
      select: {
        id: true,
        status: true,
        decidedAt: true,
        decisionDueAt: true,
        paymentProofUrl: true,
        event: { select: { organizerId: true, name: true } },
        customer: { select: { email: true, name: true } },
      },
    });
    if (!trx) throw new ApiError("Transaction not found", 404);
    if (trx.event.organizerId !== organizerId) throw new ApiError("Forbidden", 403);

    if (trx.status !== TransactionStatus.WAITING_FOR_ADMIN_CONFIRMATION) {
      throw new ApiError("Transaction is not waiting for admin confirmation", 400);
    }

    // optional: kalau mau strict
    if (!trx.paymentProofUrl) throw new ApiError("Payment proof is required", 400);

    // optional: kalau decisionDueAt sudah lewat → auto reject/expired
    if (trx.decisionDueAt && now > trx.decisionDueAt) {
      throw new ApiError("Decision due already passed. Please reject (or handle auto-cancel scheduler).", 400);
    }

    await this.prisma.transaction.update({
      where: { id: trxId },
      data: {
        status: TransactionStatus.DONE,
        decidedAt: now,
        decisionDueAt: null,
      },
    });

    // email notification (jangan bikin crash)
    try {
      await this.mail.sendEmail(
        trx.customer.email,
        "Payment Accepted",
        "transaction-status",
        { name: trx.customer.name, eventName: trx.event.name, status: "ACCEPTED" }
      );
    } catch (e) {
      // silent
    }

    return { message: "transaction accepted" };
  };

  reject = async (trxId: number, organizerId: number) => {
    return await this.prisma.$transaction(async (tx) => {
      const now = new Date();

      const trx = await tx.transaction.findUnique({
        where: { id: trxId },
        select: {
          id: true,
          status: true,
          event: { select: { organizerId: true, name: true } },
          customer: { select: { email: true, name: true } },
        },
      });
      if (!trx) throw new ApiError("Transaction not found", 404);
      if (trx.event.organizerId !== organizerId) throw new ApiError("Forbidden", 403);

      if (trx.status !== TransactionStatus.WAITING_FOR_ADMIN_CONFIRMATION) {
        throw new ApiError("Transaction is not waiting for admin confirmation", 400);
      }

      // ✅ rollback seats/voucher/coupon/points + set status REJECTED
      await this.rollbackTx(tx, trxId, TransactionStatus.REJECTED, "REJECTED_BY_ORGANIZER");

      // email (optional)
      try {
        await this.mail.sendEmail(
          trx.customer.email,
          "Payment Rejected",
          "transaction-status",
          { name: trx.customer.name, eventName: trx.event.name, status: "REJECTED" }
        );
      } catch (e) {
        // silent
      }

      return { message: "transaction rejected" };
    });
  };

  // === shared rollback helper (expire/cancel/reject) ===
  private rollbackTx = async (
    tx: any,
    trxId: number,
    newStatus: TransactionStatus,
    referenceId: string
  ) => {
    const now = new Date();

    const trx = await tx.transaction.findUnique({
      where: { id: trxId },
      select: {
        id: true,
        status: true,
        decidedAt: true,
        eventId: true,
        qty: true,
        voucherId: true,
        couponId: true,
        pointsUsed: true,
        ticketTypeId: true,
        customerId: true,
      },
    });
    if (!trx) throw new ApiError("Transaction not found", 404);
    if (trx.decidedAt) return; // already decided

    // restore event seats
    await tx.event.update({
      where: { id: trx.eventId },
      data: { remainingSeats: { increment: trx.qty } },
    });

    // restore ticketType seats if used
    if (trx.ticketTypeId) {
      await tx.ticketType.update({
        where: { id: trx.ticketTypeId },
        data: { remainingSeats: { increment: trx.qty } },
      });
    }

    // rollback voucher usedCount
    if (trx.voucherId) {
      await tx.voucher.updateMany({
        where: { id: trx.voucherId, usedCount: { gt: 0 } },
        data: { usedCount: { decrement: 1 } },
      });
    }

    // rollback coupon usedAt
    if (trx.couponId) {
      await tx.coupon.update({
        where: { id: trx.couponId },
        data: { usedAt: null },
      });
    }

    // rollback points
    if (trx.pointsUsed && trx.pointsUsed > 0) {
      await tx.pointLedger.create({
        data: {
          userId: trx.customerId,
          amount: trx.pointsUsed,
          reason: PointReason.ROLLBACK,
          expiresAt: addMonths(now, 3),
          transactionId: trx.id,
          referenceId,
        },
      });
    }

    await tx.transaction.update({
      where: { id: trxId },
      data: {
        status: newStatus,
        decidedAt: now,
        decisionDueAt: null,
      },
    });
  };
}
