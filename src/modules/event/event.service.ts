import { PrismaService } from "../prisma/prisma.service";
import { ApiError } from "../../utils/api-error";

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

    const [items, total] = await Promise.all([
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
          imageUrl: true, // ✅
          organizer: { select: { id: true, name: true } },
        },
      }),
      this.prisma.event.count({ where }),
    ]);

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
        imageUrl: true, // ✅
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

    const created = await this.prisma.event.create({
      data: {
        organizerId,
        name: body.name,
        description: body.description,
        category: body.category,
        location: body.location,
        startAt,
        endAt,
        price,
        totalSeats,
        remainingSeats: totalSeats,
        isPublished: body.isPublished ?? true,
        imageUrl: body.imageUrl ?? null, // ✅
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

    if (body.name !== undefined) data.name = body.name;
    if (body.description !== undefined) data.description = body.description;
    if (body.category !== undefined) data.category = body.category;
    if (body.location !== undefined) data.location = body.location;
    if (body.isPublished !== undefined) data.isPublished = body.isPublished;

    if (body.imageUrl !== undefined) data.imageUrl = body.imageUrl || null; // ✅

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

  createVoucher = async (eventId: number, body: any, organizerId: number) => {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, organizerId: true },
    });
    if (!event) throw new ApiError("Event not found", 404);
    if (event.organizerId !== organizerId) throw new ApiError("Forbidden", 403);

    const startAt = new Date(body.startAt);
    const endAt = new Date(body.endAt);
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      throw new ApiError("Invalid startAt/endAt", 400);
    }
    if (endAt <= startAt) throw new ApiError("endAt must be after startAt", 400);

    const discountAmount = Number(body.discountAmount);
    if (!discountAmount || discountAmount < 1) throw new ApiError("discountAmount must be >= 1", 400);

    const created = await this.prisma.voucher.create({
      data: {
        eventId,
        code: body.code,
        discountAmount,
        startAt,
        endAt,
        maxUses: body.maxUses ?? null,
      },
      select: { id: true, code: true },
    });

    return { message: "voucher created", voucher: created };
  };
}
