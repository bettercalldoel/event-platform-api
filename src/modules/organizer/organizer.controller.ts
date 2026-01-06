import { Request, Response } from "express";
import { OrganizerService } from "./organizer.service";
import { ApiError } from "../../utils/api-error";

export class OrganizerController {
  service: OrganizerService;

  constructor() {
    this.service = new OrganizerService();
  }

  // GET /organizer/events
  myEvents = async (req: Request, res: Response) => {
    const organizerId = Number(res.locals.user.id);
    if (!organizerId) throw new ApiError("Unauthorized", 401);

    const sort = req.query.sort ? String(req.query.sort) : undefined;

    const result = await this.service.myEvents(organizerId, sort);
    return res.status(200).send(result);
  };

  // GET /organizer/transactions
  myTransactions = async (req: Request, res: Response) => {
    const organizerId = Number(res.locals.user.id);
    if (!organizerId) throw new ApiError("Unauthorized", 401);

    const status = req.query.status ? String(req.query.status) : undefined;

    const result = await this.service.myTransactions(organizerId, status);
    return res.status(200).send(result);
  };

  // GET /organizer/events/:eventId/attendees
  attendees = async (req: Request, res: Response) => {
    const organizerId = Number(res.locals.user.id);
    if (!organizerId) throw new ApiError("Unauthorized", 401);

    const eventId = Number(req.params.eventId);
    if (!eventId || Number.isNaN(eventId)) {
      throw new ApiError("Invalid event id", 400);
    }

    const result = await this.service.attendees(organizerId, eventId);
    return res.status(200).send(result);
  };

  // GET /organizer/stats?range=year|month|day
  stats = async (req: Request, res: Response) => {
    const organizerId = Number(res.locals.user.id);
    if (!organizerId) throw new ApiError("Unauthorized", 401);

    const raw = (req.query.range ? String(req.query.range) : "year").toLowerCase();
    const allowed = ["year", "month", "day"] as const;
    const range = (allowed.includes(raw as any) ? raw : "year") as
      | "year"
      | "month"
      | "day";

    const result = await this.service.stats(organizerId, range);
    return res.status(200).send(result);
  };
}
