import { Prisma, TransactionStatus } from "@prisma/client";
import { ApiError } from "../../utils/api-error";
import { PrismaService } from "../prisma/prisma.service";
import { CreateTransactionDTO } from "./dto/create-transaction.dto";
import { UploadPaymentProofDTO } from "./dto/upload-payment-proof.dto";
import { MailService } from "../mail/mail.service";

function addHours(d: Date, h: number) {
  const x = new Date(d);
  x.setHours(x.getHours() + h);
  return x;
}
function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}
function addMonths(d: Date, m: number) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + m);
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
    return rows.reduce((sum, r) => sum + r.amount, 0);
  };

  create = async (customerId: number, body: CreateTransactionDTO) => {
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const event = await tx.event.findUnique({
        where: { id: body.eventId },
        include: { organizer: true },
      });
      if (!event) throw new ApiError("Event not found", 404);
      if (!event.isPublished) throw new ApiError("Event is not published", 400);

      // price source: ticketType if provided, else event
      let unitPrice = event.price;
      let ticketType: any = null;

      if (body.ticketTypeId) {
        ticketType = await tx.ticketType.findUnique({ where: { id: body.ticketTypeId } });
        if (!ticketType || ticketType.eventId !== event.id) throw new ApiError("Invalid ticketTypeId", 400);
        unitPrice = ticketType.price;
      }

      // seats check & reserve
      if (ticketType) {
        if (ticketType.remainingSeats < body.qty) throw new ApiError("Not enough ticket seats", 400);
        await tx.ticketType.update({
          where: { id: ticketType.id },
          data: { remainingSeats: ticketType.remainingSeats - body.qty },
        });
      } else {
        if (event.remainingSeats < body.qty) throw new ApiError("Not enough event seats", 400);
        await tx.event.update({
          where: { id: event.id },
          data: { remainingSeats: event.remainingSeats - body.qty },
        });
      }

      const subtotal = unitPrice * body.qty;

      // apply voucher
      let voucherId: number | null = null;
      let voucherDiscount = 0;
      if (body.voucherCode) {
        const v = await tx.voucher.findUnique({ where: { code: body.voucherCode } });
        if (!v || v.eventId !== event.id) throw new ApiError("Invalid voucher", 400);
        if (v.startAt > now || v.endAt < now) throw new ApiError("Voucher not active", 400);
        if (v.maxUses !== null && v.usedCount >= v.maxUses) throw new ApiError("Voucher max uses reached", 400);

        voucherId = v.id;
        voucherDiscount = Math.min(subtotal, v.discountAmount);

        await tx.voucher.update({
          where: { id: v.id },
          data: { usedCount: v.usedCount + 1 },
        });
      }

      // apply coupon
      let couponId: number | null = null;
      let couponDiscount = 0;
      if (body.couponCode) {
        const c = await tx.coupon.findUnique({ where: { code: body.couponCode } });
        if (!c || c.userId !== customerId) throw new ApiError("Invalid coupon", 400);
        if (c.expiresAt < now) throw new ApiError("Coupon expired", 400);
        if (c.usedAt) throw new ApiError("Coupon already used", 400);

        couponId = c.id;
        couponDiscount = Math.min(subtotal - voucherDiscount, c.discountAmount);

        await tx.coupon.update({
          where: { id: c.id },
          data: { usedAt: now },
        });
      }

      // points
      const availablePoints = await this.calcAvailablePoints(customerId);
      const maxPayable = Math.max(0, subtotal - voucherDiscount - couponDiscount);
      const requestedPoints = Math.max(0, Number(body.pointsUsed ?? 0));
      const pointsUsed = Math.min(requestedPoints, availablePoints, maxPayable);

      // debit points (ledger -)
      if (pointsUsed > 0) {
        await tx.pointLedger.create({
          data: {
            userId: customerId,
            amount: -pointsUsed,
            reason: "USED_IN_TRANSACTION",
            expiresAt: null,
          },
        });
      }

      const total = Math.max(0, maxPayable - pointsUsed);

      const isFree = total === 0;

      const created = await tx.transaction.create({
        data: {
          customerId,
          eventId: event.id,
          ticketTypeId: ticketType?.id ?? null,
          qty: body.qty,

          subtotalAmount: subtotal,
          voucherId,
          voucherDiscount,
          couponId, // unique constraint: ok
          couponDiscount,
          pointsUsed,
          totalAmount: total,

          status: isFree ? TransactionStatus.DONE : TransactionStatus.WAITING_FOR_PAYMENT,
          paymentDueAt: isFree ? now : addHours(now, 2),
          decisionDueAt: null,
          decidedAt: isFree ? now : null,
        },
        select: { id: true, status: true, paymentDueAt: true, totalAmount: true },
      });

      return {
        message: "transaction created",
        transaction: created,
      };
    });
  };

  uploadPaymentProof = async (customerId: number, id: number, body: UploadPaymentProofDTO) => {
    const now = new Date();

    const trx = await this.prisma.transaction.findUnique({
      where: { id },
      include: { event: true },
    });
    if (!trx) throw new ApiError("Transaction not found", 404);
    if (trx.customerId !== customerId) throw new ApiError("Forbidden", 403);

    if (trx.status !== TransactionStatus.WAITING_FOR_PAYMENT) {
      throw new ApiError("Transaction is not waiting for payment", 400);
    }
    if (now > trx.paymentDueAt) throw new ApiError("Payment time expired", 400);

    const updated = await this.prisma.transaction.update({
      where: { id },
      data: {
        paymentProofUrl: body.paymentProofUrl,
        paymentProofUploadedAt: now,
        status: TransactionStatus.WAITING_FOR_ADMIN_CONFIRMATION,
        decisionDueAt: addDays(now, 3),
      },
      select: { id: true, status: true, decisionDueAt: true },
    });

    return { message: "payment proof uploaded", transaction: updated };
  };

  organizerAccept = async (organizerId: number, id: number) => {
    const trx = await this.prisma.transaction.findUnique({
      where: { id },
      include: { event: true, customer: true },
    });
    if (!trx) throw new ApiError("Transaction not found", 404);
    if (trx.event.organizerId !== organizerId) throw new ApiError("Forbidden", 403);

    if (trx.status !== TransactionStatus.WAITING_FOR_ADMIN_CONFIRMATION) {
      throw new ApiError("Transaction is not waiting for admin confirmation", 400);
    }

    const now = new Date();
    const updated = await this.prisma.transaction.update({
      where: { id },
      data: { status: TransactionStatus.DONE, decidedAt: now },
      select: { id: true, status: true },
    });

    // email notification (jangan bikin transaksi gagal kalau email error)
    try {
      await this.mail.sendEmail(trx.customer.email, "Transaction Accepted", "transaction-accepted", {
        transactionId: trx.id,
        eventName: trx.event.name,
      });
    } catch (e) {
      console.error("Email accept failed:", e);
    }

    return { message: "accepted", transaction: updated };
  };

  organizerReject = async (organizerId: number, id: number) => {
    const trx = await this.prisma.transaction.findUnique({
      where: { id },
      include: { event: true, customer: true },
    });
    if (!trx) throw new ApiError("Transaction not found", 404);
    if (trx.event.organizerId !== organizerId) throw new ApiError("Forbidden", 403);

    if (trx.status !== TransactionStatus.WAITING_FOR_ADMIN_CONFIRMATION) {
      throw new ApiError("Transaction is not waiting for admin confirmation", 400);
    }

    await this.rollbackAndSetStatus(id, TransactionStatus.REJECTED);

    try {
      await this.mail.sendEmail(trx.customer.email, "Transaction Rejected", "transaction-rejected", {
        transactionId: trx.id,
        eventName: trx.event.name,
      });
    } catch (e) {
      console.error("Email reject failed:", e);
    }

    return { message: "rejected" };
  };

  myTransactions = async (customerId: number) => {
    const items = await this.prisma.transaction.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        qty: true,
        totalAmount: true,
        paymentDueAt: true,
        decisionDueAt: true,
        createdAt: true,
        event: { select: { id: true, name: true, startAt: true, location: true } },
      },
    });
    return { items };
  };

  organizerTransactions = async (organizerId: number, eventId?: number) => {
    const where: Prisma.TransactionWhereInput = {
      event: { organizerId },
    };
    if (eventId) where.eventId = eventId;

    const items = await this.prisma.transaction.findMany({
      where,
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
        createdAt: true,
        customer: { select: { id: true, name: true, email: true } },
        event: { select: { id: true, name: true } },
      },
    });

    return { items };
  };

  // === AUTO JOBS ===
  autoExpire = async () => {
    const now = new Date();
    const targets = await this.prisma.transaction.findMany({
      where: {
        status: TransactionStatus.WAITING_FOR_PAYMENT,
        paymentDueAt: { lt: now },
        paymentProofUploadedAt: null,
      },
      select: { id: true },
    });

    for (const t of targets) {
      await this.rollbackAndSetStatus(t.id, TransactionStatus.EXPIRED);
    }

    return { expired: targets.length };
  };

  autoCancel = async () => {
    const now = new Date();
    const targets = await this.prisma.transaction.findMany({
      where: {
        status: TransactionStatus.WAITING_FOR_ADMIN_CONFIRMATION,
        decisionDueAt: { lt: now },
      },
      select: { id: true },
    });

    for (const t of targets) {
      await this.rollbackAndSetStatus(t.id, TransactionStatus.CANCELED);
    }

    return { canceled: targets.length };
  };

  // rollback seats + voucher + coupon + points
  private rollbackAndSetStatus = async (transactionId: number, status: TransactionStatus) => {
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      const trx = await tx.transaction.findUnique({
        where: { id: transactionId },
        select: {
          id: true,
          status: true,
          customerId: true,
          eventId: true,
          ticketTypeId: true,
          qty: true,
          voucherId: true,
          couponId: true,
          pointsUsed: true,
        },
      });
      if (!trx) return;

      // only rollback once
      if (
        trx.status === TransactionStatus.DONE ||
        trx.status === TransactionStatus.REJECTED ||
        trx.status === TransactionStatus.EXPIRED ||
        trx.status === TransactionStatus.CANCELED
      ) {
        return;
      }

      // restore seats
      if (trx.ticketTypeId) {
        const tt = await tx.ticketType.findUnique({ where: { id: trx.ticketTypeId } });
        if (tt) {
          const next = Math.min(tt.totalSeats, tt.remainingSeats + trx.qty);
          await tx.ticketType.update({ where: { id: tt.id }, data: { remainingSeats: next } });
        }
      } else {
        const ev = await tx.event.findUnique({ where: { id: trx.eventId } });
        if (ev) {
          const next = Math.min(ev.totalSeats, ev.remainingSeats + trx.qty);
          await tx.event.update({ where: { id: ev.id }, data: { remainingSeats: next } });
        }
      }

      // rollback voucher usedCount
      if (trx.voucherId) {
        const v = await tx.voucher.findUnique({ where: { id: trx.voucherId } });
        if (v) {
          await tx.voucher.update({
            where: { id: v.id },
            data: { usedCount: Math.max(0, v.usedCount - 1) },
          });
        }
      }

      // rollback coupon (release)
      if (trx.couponId) {
        await tx.coupon.update({
          where: { id: trx.couponId },
          data: { usedAt: null },
        });

        // IMPORTANT: supaya coupon bisa dipakai lagi, kita harus clear couponId di transaksi (karena unique)
        await tx.transaction.update({
          where: { id: trx.id },
          data: { couponId: null, couponDiscount: 0 },
        });
      }

      // rollback points
      if (trx.pointsUsed > 0) {
        await tx.pointLedger.create({
          data: {
            userId: trx.customerId,
            amount: trx.pointsUsed,
            reason: "ROLLBACK",
            expiresAt: addMonths(now, 3),
            transactionId: trx.id,
          },
        });

        await tx.transaction.update({
          where: { id: trx.id },
          data: { pointsUsed: 0 },
        });
      }

      // finally set status
      await tx.transaction.update({
        where: { id: trx.id },
        data: { status, decidedAt: now },
      });
    });
  };
}
