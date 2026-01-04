import { Request, Response } from "express";
import { TransactionService } from "./transaction.service";

export class TransactionController {
  service: TransactionService;

  constructor() {
    this.service = new TransactionService();
  }

  create = async (req: Request, res: Response) => {
    const customerId = Number(res.locals.user.id);
    const result = await this.service.create(customerId, req.body);
    return res.status(201).send(result);
  };

  uploadProof = async (req: Request, res: Response) => {
    const customerId = Number(res.locals.user.id);
    const id = Number(req.params.id);
    const result = await this.service.uploadPaymentProof(customerId, id, req.body);
    return res.status(200).send(result);
  };

  accept = async (req: Request, res: Response) => {
    const organizerId = Number(res.locals.user.id);
    const id = Number(req.params.id);
    const result = await this.service.organizerAccept(organizerId, id);
    return res.status(200).send(result);
  };

  reject = async (req: Request, res: Response) => {
    const organizerId = Number(res.locals.user.id);
    const id = Number(req.params.id);
    const result = await this.service.organizerReject(organizerId, id);
    return res.status(200).send(result);
  };

  me = async (_req: Request, res: Response) => {
    const customerId = Number(res.locals.user.id);
    const result = await this.service.myTransactions(customerId);
    return res.status(200).send(result);
  };

  organizerList = async (req: Request, res: Response) => {
    const organizerId = Number(res.locals.user.id);
    const eventId = req.query.eventId ? Number(req.query.eventId) : undefined;
    const result = await this.service.organizerTransactions(organizerId, eventId);
    return res.status(200).send(result);
  };
}
