import { PrismaService } from "../prisma/prisma.service";
import { ApiError } from "../../utils/api-error";
import { TransactionStatus } from "@prisma/client";

export class EventService {
  prisma: PrismaService;

  constructor() {
    this.prisma = new PrismaService();
  }

  list = async (query: any) => {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(50, Math.max(1, Number(query.limit || 10)));
    const skip = (page - 1) * limit;

    const q = String(query.q || "").trim();
    const category = String(query.category || "").trim();
    const location = String(query.location || "").trim();

    const where: any = { isPublished: true };

    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ];
    }
    if (category) where.category = { contains: category, mode: "insensitive" };
    if (location) where.location = { contains: location, mode: "insensitive" };

    const [events, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        orderBy: { startAt: "asc" },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          category: true,
          location: true,
          startAt: true,
          endAt: true,
          price: true,
          remainingSeats: true,
          imageUrl: true,
          organizer: { select: { id: true, name: true } },
        },
      }),
      this.prisma.event.count({ where }),
    ]);

    // add rating summary (avgRating, totalReviews) WITHOUT putting into Prisma select
    const ids = events.map((e) => e.id);
    const groups =
      ids.length === 0
        ? []
        : await this.prisma.review.groupBy({
            by: ["eventId"],
            where: { eventId: { in: ids } },
            _avg: { rating: true },
            _count: { _all: true },
          });

    const map = new Map<number, { avgRating: number | null; totalReviews: number }>();
    for (const g of groups) {
      map.set(g.eventId, {
        avgRating: g._avg.rating ? Number(g._avg.rating) : null,
        totalReviews: g._count._all,
      });
    }

    const items = events.map((e) => {
      const s = map.get(e.id) ?? { avgRating: null, totalReviews: 0 };
      return { ...e, ...s };
    });

    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      items,
    };
  };

  detail = async (id: number) => {
    const now = new Date();

    const event = await this.prisma.event.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        location: true,
        startAt: true,
        endAt: true,
        price: true,
        totalSeats: true,
        remainingSeats: true,
        isPublished: true,
        imageUrl: true,
        organizer: { select: { id: true, name: true } },
        ticketTypes: {
          select: { id: true, name: true, price: true, remainingSeats: true },
          orderBy: { id: "asc" },
        },
        vouchers: {
          where: { startAt: { lte: now }, endAt: { gte: now } },
          select: {
            id: true,
            code: true,
            discountAmount: true,
            startAt: true,
            endAt: true,
            maxUses: true,
            usedCount: true,
          },
          orderBy: { id: "asc" },
        },
      },
    });

    if (!event) throw new ApiError("Event not found", 404);
    return event;
  };

  create = async (body: any, organizerId: number) => {
    const startAt = new Date(body.startAt);
    const endAt = new Date(body.endAt);

    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      throw new ApiError("Invalid startAt/endAt", 400);
    }
    if (endAt <= startAt) throw new ApiError("endAt must be after startAt", 400);

    const totalSeats = Number(body.totalSeats);
    if (!totalSeats || totalSeats < 1) throw new ApiError("totalSeats must be >= 1", 400);

    const price = Number(body.price ?? 0);
    if (price < 0) throw new ApiError("price must be >= 0", 400);

    const imageUrl = body.imageUrl ? String(body.imageUrl).trim() : null;

    const created = await this.prisma.event.create({
      data: {
        organizerId,
        name: String(body.name),
        description: String(body.description),
        category: String(body.category),
        location: String(body.location),
        startAt,
        endAt,
        price,
        totalSeats,
        remainingSeats: totalSeats,
        isPublished: body.isPublished ?? true,
        imageUrl,
      },
      select: { id: true },
    });

    return { message: "event created", id: created.id };
  };

  update = async (id: number, body: any, organizerId: number) => {
    const existing = await this.prisma.event.findUnique({
      where: { id },
      select: { id: true, organizerId: true, totalSeats: true, remainingSeats: true },
    });
    if (!existing) throw new ApiError("Event not found", 404);
    if (existing.organizerId !== organizerId) throw new ApiError("Forbidden", 403);

    const data: any = {};

    if (body.name !== undefined) data.name = String(body.name);
    if (body.description !== undefined) data.description = String(body.description);
    if (body.category !== undefined) data.category = String(body.category);
    if (body.location !== undefined) data.location = String(body.location);
    if (body.isPublished !== undefined) data.isPublished = Boolean(body.isPublished);

    if (body.imageUrl !== undefined) {
      const url = String(body.imageUrl || "").trim();
      data.imageUrl = url ? url : null;
    }

    if (body.startAt !== undefined) {
      const d = new Date(body.startAt);
      if (Number.isNaN(d.getTime())) throw new ApiError("Invalid startAt", 400);
      data.startAt = d;
    }
    if (body.endAt !== undefined) {
      const d = new Date(body.endAt);
      if (Number.isNaN(d.getTime())) throw new ApiError("Invalid endAt", 400);
      data.endAt = d;
    }
    if (data.startAt && data.endAt && data.endAt <= data.startAt) {
      throw new ApiError("endAt must be after startAt", 400);
    }

    if (body.price !== undefined) {
      const price = Number(body.price);
      if (price < 0) throw new ApiError("price must be >= 0", 400);
      data.price = price;
    }

    if (body.totalSeats !== undefined) {
      const newTotal = Number(body.totalSeats);
      if (!newTotal || newTotal < 1) throw new ApiError("totalSeats must be >= 1", 400);

      const used = existing.totalSeats - existing.remainingSeats;
      if (newTotal < used) throw new ApiError(`totalSeats cannot be < used seats (${used})`, 400);

      data.totalSeats = newTotal;
      data.remainingSeats = newTotal - used;
    }

    await this.prisma.event.update({ where: { id }, data });
    return { message: "event updated" };
  };

  // =========================
  // VOUCHERS (organizer only)
  // =========================
  private assertOrganizerOwnsEvent = async (eventId: number, organizerId: number) => {
    const e = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, organizerId: true },
    });
    if (!e) throw new ApiError("Event not found", 404);
    if (e.organizerId !== organizerId) throw new ApiError("Forbidden", 403);
    return e;
  };

  createVoucher = async (eventId: number, body: any, organizerId: number) => {
    await this.assertOrganizerOwnsEvent(eventId, organizerId);

    const startAt = new Date(body.startAt);
    const endAt = new Date(body.endAt);
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      throw new ApiError("Invalid startAt/endAt", 400);
    }
    if (endAt <= startAt) throw new ApiError("endAt must be after startAt", 400);

    const discountAmount = Number(body.discountAmount);
    if (!discountAmount || discountAmount < 1) throw new ApiError("discountAmount must be >= 1", 400);

    const code = String(body.code || "").trim();
    if (!code) throw new ApiError("code is required", 400);

    const created = await this.prisma.voucher.create({
      data: {
        eventId,
        code,
        discountAmount,
        startAt,
        endAt,
        maxUses: body.maxUses ?? null,
      },
      select: { id: true, code: true, discountAmount: true, startAt: true, endAt: true, maxUses: true, usedCount: true },
    });

    return { message: "voucher created", voucher: created };
  };

  listVouchers = async (eventId: number, organizerId: number) => {
    await this.assertOrganizerOwnsEvent(eventId, organizerId);

    const items = await this.prisma.voucher.findMany({
      where: { eventId },
      orderBy: { id: "desc" },
      select: {
        id: true,
        code: true,
        discountAmount: true,
        startAt: true,
        endAt: true,
        maxUses: true,
        usedCount: true,
        createdAt: true,
      },
    });

    return { items };
  };

  updateVoucher = async (eventId: number, voucherId: number, body: any, organizerId: number) => {
    await this.assertOrganizerOwnsEvent(eventId, organizerId);

    const v = await this.prisma.voucher.findUnique({
      where: { id: voucherId },
      select: { id: true, eventId: true, usedCount: true, maxUses: true },
    });
    if (!v || v.eventId !== eventId) throw new ApiError("Voucher not found", 404);

    const data: any = {};

    if (body.code !== undefined) {
      const code = String(body.code || "").trim();
      if (!code) throw new ApiError("code cannot be empty", 400);
      data.code = code;
    }
    if (body.discountAmount !== undefined) {
      const d = Number(body.discountAmount);
      if (!d || d < 1) throw new ApiError("discountAmount must be >= 1", 400);
      data.discountAmount = d;
    }
    if (body.startAt !== undefined) {
      const d = new Date(body.startAt);
      if (Number.isNaN(d.getTime())) throw new ApiError("Invalid startAt", 400);
      data.startAt = d;
    }
    if (body.endAt !== undefined) {
      const d = new Date(body.endAt);
      if (Number.isNaN(d.getTime())) throw new ApiError("Invalid endAt", 400);
      data.endAt = d;
    }
    if (data.startAt && data.endAt && data.endAt <= data.startAt) {
      throw new ApiError("endAt must be after startAt", 400);
    }

    if (body.maxUses !== undefined) {
      const mu = body.maxUses === null ? null : Number(body.maxUses);
      if (mu !== null && (!mu || mu < 1)) throw new ApiError("maxUses must be null or >= 1", 400);
      if (mu !== null && v.usedCount > mu) throw new ApiError(`maxUses cannot be < usedCount (${v.usedCount})`, 400);
      data.maxUses = mu;
    }

    const updated = await this.prisma.voucher.update({
      where: { id: voucherId },
      data,
      select: { id: true, code: true, discountAmount: true, startAt: true, endAt: true, maxUses: true, usedCount: true },
    });

    return { message: "voucher updated", voucher: updated };
  };

  deleteVoucher = async (eventId: number, voucherId: number, organizerId: number) => {
    await this.assertOrganizerOwnsEvent(eventId, organizerId);

    const v = await this.prisma.voucher.findUnique({
      where: { id: voucherId },
      select: { id: true, eventId: true, usedCount: true },
    });
    if (!v || v.eventId !== eventId) throw new ApiError("Voucher not found", 404);

    // aman: kalau sudah dipakai, biar tidak mengacau histori transaksi
    if (v.usedCount > 0) throw new ApiError("Voucher already used; cannot delete", 400);

    await this.prisma.voucher.delete({ where: { id: voucherId } });
    return { message: "voucher deleted" };
  };

  // =========================
  // REVIEWS
  // =========================
  listReviews = async (eventId: number) => {
    const rows = await this.prisma.review.findMany({
      where: { eventId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        user: { select: { id: true, name: true } },
      },
    });

    const totalReviews = rows.length;
    const avgRating =
      totalReviews === 0
        ? null
        : Math.round((rows.reduce((acc, r) => acc + r.rating, 0) / totalReviews) * 10) / 10;

    return {
      summary: { avgRating, totalReviews },
      items: rows,
    };
  };

  createReview = async (eventId: number, body: any, userId: number) => {
    const rating = Number(body.rating);
    const comment = String(body.comment || "").trim();

    if (!rating || rating < 1 || rating > 5) throw new ApiError("rating must be 1..5", 400);
    if (!comment || comment.length < 3) throw new ApiError("comment is required", 400);

    const ev = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, endAt: true },
    });
    if (!ev) throw new ApiError("Event not found", 404);

    // hanya boleh review setelah event selesai
    if (new Date(ev.endAt).getTime() > Date.now()) {
      throw new ApiError("Review allowed only after event ended", 400);
    }

    // harus pernah DONE transaksi untuk event ini
    const ok = await this.prisma.transaction.findFirst({
      where: { eventId, customerId: userId, status: TransactionStatus.DONE },
      select: { id: true },
    });
    if (!ok) throw new ApiError("You must attend (DONE transaction) before reviewing", 400);

    // 1 user 1 review per event
    const exists = await this.prisma.review.findFirst({
      where: { eventId, userId },
      select: { id: true },
    });
    if (exists) throw new ApiError("You already reviewed this event", 400);

    const created = await this.prisma.review.create({
      data: { eventId, userId, rating, comment },
      select: { id: true, rating: true, comment: true, createdAt: true },
    });

    return { message: "review created", review: created };
  };
}
