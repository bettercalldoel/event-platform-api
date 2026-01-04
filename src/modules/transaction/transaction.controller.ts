import { Request, Response } from "express";
import { ApiError } from "../../utils/api-error";
import { TransactionService } from "./transaction.service";

export class TransactionController {
  service: TransactionService;

  constructor() {
    this.service = new TransactionService();
  }

  myTransactions = async (req: Request, res: Response) => {
    const userId = Number(res.locals.user?.id);
    if (!userId) throw new ApiError("Unauthorized", 401);

    const result = await this.service.myTransactions(userId);
    return res.status(200).send(result);
  };

  create = async (req: Request, res: Response) => {
    const userId = Number(res.locals.user?.id);
    const role = String(res.locals.user?.role || "");
    if (!userId) throw new ApiError("Unauthorized", 401);
    if (role !== "CUSTOMER") throw new ApiError("Forbidden (Customer only)", 403);

    const result = await this.service.create(req.body, userId);
    return res.status(201).send(result);
  };

  uploadPaymentProof = async (req: Request, res: Response) => {
    const userId = Number(res.locals.user?.id);
    const role = String(res.locals.user?.role || "");
    if (!userId) throw new ApiError("Unauthorized", 401);
    if (role !== "CUSTOMER") throw new ApiError("Forbidden (Customer only)", 403);

    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) throw new ApiError("Invalid transaction id", 400);

    const result = await this.service.uploadPaymentProof(id, userId, req.body);
    return res.status(200).send(result);
  };

  accept = async (req: Request, res: Response) => {
    const organizerId = Number(res.locals.user?.id);
    const role = String(res.locals.user?.role || "");
    if (!organizerId) throw new ApiError("Unauthorized", 401);
    if (role !== "ORGANIZER") throw new ApiError("Forbidden (Organizer only)", 403);

    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) throw new ApiError("Invalid transaction id", 400);

    const result = await this.service.accept(id, organizerId);
    return res.status(200).send(result);
  };

  reject = async (req: Request, res: Response) => {
    const organizerId = Number(res.locals.user?.id);
    const role = String(res.locals.user?.role || "");
    if (!organizerId) throw new ApiError("Unauthorized", 401);
    if (role !== "ORGANIZER") throw new ApiError("Forbidden (Organizer only)", 403);

    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) throw new ApiError("Invalid transaction id", 400);

    const result = await this.service.reject(id, organizerId);
    return res.status(200).send(result);
  };
}
