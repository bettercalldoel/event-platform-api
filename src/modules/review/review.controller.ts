import { Request, Response } from "express";
import { ApiError } from "../../utils/api-error";
import { ReviewService } from "./review.service";

export class ReviewController {
  service: ReviewService;

  constructor() {
    this.service = new ReviewService();
  }

  listByEvent = async (req: Request, res: Response) => {
    const eventId = Number(req.params.id);
    if (!eventId || Number.isNaN(eventId)) throw new ApiError("Invalid event id", 400);

    const result = await this.service.listByEvent(eventId);
    return res.status(200).send(result);
  };

  createForEvent = async (req: Request, res: Response) => {
    const userId = Number(res.locals.user?.id);
    if (!userId) throw new ApiError("Unauthorized", 401);

    const eventId = Number(req.params.id);
    if (!eventId || Number.isNaN(eventId)) throw new ApiError("Invalid event id", 400);

    const result = await this.service.createForEvent(eventId, userId, req.body);
    return res.status(201).send(result);
  };
}
