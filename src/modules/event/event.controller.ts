import { Request, Response } from "express";
import { EventService } from "./event.service";
import { ApiError } from "../../utils/api-error";

export class EventController {
  service: EventService;

  constructor() {
    this.service = new EventService();
  }

  list = async (req: Request, res: Response) => {
    const result = await this.service.list(req.query);
    return res.status(200).send(result);
  };

  detail = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) throw new ApiError("Invalid event id", 400);

    const result = await this.service.detail(id);
    return res.status(200).send(result);
  };

  create = async (req: Request, res: Response) => {
    const organizerId = Number(res.locals.user?.id);
    if (!organizerId) throw new ApiError("Unauthorized", 401);

    const result = await this.service.create(req.body, organizerId);
    return res.status(201).send(result);
  };

  update = async (req: Request, res: Response) => {
    const organizerId = Number(res.locals.user?.id);
    if (!organizerId) throw new ApiError("Unauthorized", 401);

    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) throw new ApiError("Invalid event id", 400);

    const result = await this.service.update(id, req.body, organizerId);
    return res.status(200).send(result);
  };

  createVoucher = async (req: Request, res: Response) => {
    const organizerId = Number(res.locals.user?.id);
    if (!organizerId) throw new ApiError("Unauthorized", 401);

    const eventId = Number(req.params.id);
    if (!eventId || Number.isNaN(eventId)) throw new ApiError("Invalid event id", 400);

    const result = await this.service.createVoucher(eventId, req.body, organizerId);
    return res.status(201).send(result);
  };
}
