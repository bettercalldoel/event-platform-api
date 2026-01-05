import { Request, Response } from "express";
import { OrganizerService } from "./organizer.service";
import { ApiError } from "../../utils/api-error";

export class OrganizerController {
  service: OrganizerService;

  constructor() {
    this.service = new OrganizerService();
  }

  myEvents = async (req: Request, res: Response) => {
    const organizerId = Number(res.locals.user.id);
    const sort = req.query.sort ? String(req.query.sort) : undefined;

    const result = await this.service.myEvents(organizerId, sort);
    return res.status(200).send(result);
  };

  myTransactions = async (req: Request, res: Response) => {
    const organizerId = Number(res.locals.user.id);
    const status = req.query.status ? String(req.query.status) : undefined;

    const result = await this.service.myTransactions(organizerId, status);
    return res.status(200).send(result);
  };

  // ✅ PUBLIC endpoint: /organizers/:id
  profile = async (req: Request, res: Response) => {
    const organizerId = Number(req.params.id);
    if (!organizerId || Number.isNaN(organizerId)) throw new ApiError("Invalid organizer id", 400);

    const result = await this.service.profile(organizerId);
    return res.status(200).send(result);
  };
}
