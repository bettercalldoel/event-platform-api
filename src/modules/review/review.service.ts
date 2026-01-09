import { PrismaService } from "../prisma/prisma.service";
import { ApiError } from "../../utils/api-error";

export class ReviewService {
  prisma: PrismaService;

  constructor() {
    this.prisma = new PrismaService();
  }

  listByEvent = async (eventId: number) => {
    const [agg, items] = await Promise.all([
      this.prisma.review.aggregate({
        where: { eventId },
        _avg: { rating: true },
        _count: { _all: true },
      }),
      this.prisma.review.findMany({
        where: { eventId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
          user: { select: { id: true, name: true } },
        },
      }),
    ]);

    return {
      summary: {
        avgRating: agg._avg.rating ?? null,
        totalReviews: agg._count._all ?? 0,
      },
      items,
    };
  };

  createForEvent = async (eventId: number, userId: number, body: any) => {
    // 1) pastikan event ada + event sudah selesai
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, endAt: true },
    });
    if (!event) throw new ApiError("Event not found", 404);

    const now = new Date();
    if (event.endAt > now) {
      throw new ApiError("You can review only after the event ends", 400);
    }

    // 2) A-3: wajib punya transaksi DONE utk event ini
    const done = await this.prisma.transaction.findFirst({
      where: {
        eventId,
        customerId: userId,
        status: "DONE",
      },
      select: { id: true },
    });

    if (!done) {
      throw new ApiError("You can review only if you have a DONE transaction for this event", 403);
    }

    // 3) create review (unique constraint: 1 user 1 review per event)
    try {
      const review = await this.prisma.review.create({
        data: {
          eventId,
          userId,
          rating: Number(body.rating),
          comment: body.comment ?? null,
        },
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
        },
      });

      return { message: "review created", review };
    } catch (e: any) {
      // Prisma unique violation (user sudah pernah review event tsb)
      if (String(e?.code) === "P2002") {
        throw new ApiError("You already reviewed this event", 400);
      }
      throw e;
    }
  };
}
