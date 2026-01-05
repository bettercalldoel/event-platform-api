import { PrismaService } from "../prisma/prisma.service";
import { ApiError } from "../../utils/api-error";

type EventSort = "NAME_ASC" | "NAME_DESC" | "DATE_ASC" | "DATE_DESC";

export class OrganizerService {
  prisma: PrismaService;

  constructor() {
    this.prisma = new PrismaService();
  }

  myEvents = async (organizerId: number, sort?: string) => {
    const s = (sort as EventSort) || "DATE_ASC";

    let orderBy: any = { startAt: "asc" };
    if (s === "NAME_ASC") orderBy = { name: "asc" };
    if (s === "NAME_DESC") orderBy = { name: "desc" };
    if (s === "DATE_ASC") orderBy = { startAt: "asc" };
    if (s === "DATE_DESC") orderBy = { startAt: "desc" };

    const items = await this.prisma.event.findMany({
      where: { organizerId },
      orderBy,
      select: {
        id: true,
        name: true,
        category: true,
        location: true,
        description: true,
        startAt: true,
        endAt: true,
        price: true,
        totalSeats: true,
        remainingSeats: true,
        isPublished: true,
        imageUrl: true, // ✅ kalau kamu sudah pakai imageUrl
        createdAt: true,
        updatedAt: true,
      },
    });

    return { items };
  };

  myTransactions = async (organizerId: number, status?: string) => {
    const where: any = { event: { organizerId } };
    if (status) where.status = status;

    const items = await this.prisma.transaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        qty: true,
        totalAmount: true,
        paymentProofUrl: true,
        createdAt: true,
        event: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true, email: true } },
      },
    });

    return { items };
  };

  // ✅ public organizer profile (rating + review list)
  profile = async (organizerId: number) => {
    const organizer = await this.prisma.user.findUnique({
      where: { id: organizerId },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
      },
    });

    if (!organizer) throw new ApiError("Organizer not found", 404);
    if (organizer.role !== "ORGANIZER") throw new ApiError("User is not organizer", 400);

    // ambil semua review untuk event yang dibuat organizer ini
    const [reviews, agg] = await Promise.all([
      this.prisma.review.findMany({
        where: { event: { organizerId } },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
          user: { select: { id: true, name: true } },
          event: { select: { id: true, name: true } },
        },
      }),
      this.prisma.review.aggregate({
        where: { event: { organizerId } },
        _avg: { rating: true },
        _count: { rating: true },
      }),
    ]);

    return {
      organizer,
      summary: {
        avgRating: agg._avg.rating ?? 0,
        totalReviews: agg._count.rating ?? 0,
      },
      reviews,
    };
  };
}
