import { PrismaService } from "../prisma/prisma.service";
import { ApiError } from "../../utils/api-error";
import { TransactionStatus } from "@prisma/client";

type EventSort = "NAME_ASC" | "NAME_DESC" | "DATE_ASC" | "DATE_DESC";
type StatsRange = "year" | "month" | "day";

export class OrganizerService {
  prisma: PrismaService;

  constructor() {
    this.prisma = new PrismaService();
  }

  // === My Events (list event milik organizer) ===
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
        imageUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return { items };
  };

  // === My Transactions (transaksi untuk event milik organizer) ===
  myTransactions = async (organizerId: number, status?: string) => {
    const where: any = {
      event: { organizerId },
    };
    if (status) where.status = status as TransactionStatus;

    const items = await this.prisma.transaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        qty: true,
        totalAmount: true,
        paymentProofUrl: true,
        paymentProofUploadedAt: true,
        createdAt: true,
        event: {
          select: {
            id: true,
            name: true,
            startAt: true,
          },
        },
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return { items };
  };

  // === Attendees list per event (DONE only) ===
  attendees = async (organizerId: number, eventId: number) => {
    const event = await this.prisma.event.findFirst({
      where: {
        id: eventId,
        organizerId,
      },
      select: {
        id: true,
        name: true,
        startAt: true,
        location: true,
      },
    });

    if (!event) {
      throw new ApiError("Event not found or not yours", 404);
    }

    const items = await this.prisma.transaction.findMany({
      where: {
        eventId,
        status: TransactionStatus.DONE,
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        qty: true,
        totalAmount: true,
        createdAt: true,
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return {
      event,
      items,
    };
  };

  // === Stats (year / month / day) ===
  stats = async (organizerId: number, range: StatsRange = "year") => {
    let rows: {
      period: Date;
      eventId: number;
      eventName: string;
      totalTickets: bigint;
      totalRevenue: bigint;
    }[] = [];

    if (range === "month") {
      rows = await this.prisma.$queryRaw<
        {
          period: Date;
          eventId: number;
          eventName: string;
          totalTickets: bigint;
          totalRevenue: bigint;
        }[]
      >`
        SELECT
          DATE_TRUNC('month', t."createdAt") AS "period",
          e.id AS "eventId",
          e.name AS "eventName",
          SUM(t.qty)::bigint AS "totalTickets",
          SUM(t."totalAmount")::bigint AS "totalRevenue"
        FROM "transactions" t
        JOIN "events" e ON e.id = t."eventId"
        WHERE e."organizerId" = ${organizerId}
          AND t.status = 'DONE'::"TransactionStatus"
        GROUP BY "period", e.id, e.name
        ORDER BY "period" ASC, "eventName" ASC
      `;
    } else if (range === "day") {
      rows = await this.prisma.$queryRaw<
        {
          period: Date;
          eventId: number;
          eventName: string;
          totalTickets: bigint;
          totalRevenue: bigint;
        }[]
      >`
        SELECT
          DATE_TRUNC('day', t."createdAt") AS "period",
          e.id AS "eventId",
          e.name AS "eventName",
          SUM(t.qty)::bigint AS "totalTickets",
          SUM(t."totalAmount")::bigint AS "totalRevenue"
        FROM "transactions" t
        JOIN "events" e ON e.id = t."eventId"
        WHERE e."organizerId" = ${organizerId}
          AND t.status = 'DONE'::"TransactionStatus"
        GROUP BY "period", e.id, e.name
        ORDER BY "period" ASC, "eventName" ASC
      `;
    } else {
      // default year
      rows = await this.prisma.$queryRaw<
        {
          period: Date;
          eventId: number;
          eventName: string;
          totalTickets: bigint;
          totalRevenue: bigint;
        }[]
      >`
        SELECT
          DATE_TRUNC('year', t."createdAt") AS "period",
          e.id AS "eventId",
          e.name AS "eventName",
          SUM(t.qty)::bigint AS "totalTickets",
          SUM(t."totalAmount")::bigint AS "totalRevenue"
        FROM "transactions" t
        JOIN "events" e ON e.id = t."eventId"
        WHERE e."organizerId" = ${organizerId}
          AND t.status = 'DONE'::"TransactionStatus"
        GROUP BY "period", e.id, e.name
        ORDER BY "period" ASC, "eventName" ASC
      `;
    }

    const items = rows.map((r) => ({
      period: r.period,
      eventId: r.eventId,
      eventName: r.eventName,
      totalTickets: Number(r.totalTickets || 0),
      totalRevenue: Number(r.totalRevenue || 0),
    }));

    return {
      range,
      items,
    };
  };
}
