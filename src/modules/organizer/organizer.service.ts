import { PrismaService } from "../prisma/prisma.service";

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
        imageUrl: true, // ✅
        createdAt: true,
        updatedAt: true,
      },
    });

    return { items };
  };

  myTransactions = async (organizerId: number, status?: string) => {
    const where: any = {
      event: { organizerId },
    };
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
}
