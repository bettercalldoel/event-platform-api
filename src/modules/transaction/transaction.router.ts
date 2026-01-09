import { Router } from "express";
import { JwtMiddleware } from "../../middlewares/jwt.middleware";
import { validateBody } from "../../middlewares/validation.middleware";
import { requireOrganizer } from "../../middlewares/role.middleware";
import { TransactionController } from "./transaction.controller";
import { CreateTransactionDTO } from "./dto/create-transaction.dto";
import { UploadPaymentProofDTO } from "./dto/upload-payment-proof.dto";

export class TransactionRouter {
  router: Router;
  controller: TransactionController;
  jwt: JwtMiddleware;

  constructor() {
    this.router = Router();
    this.controller = new TransactionController();
    this.jwt = new JwtMiddleware();
    this.initRoutes();
  }

  private initRoutes() {
    // CUSTOMER
    this.router.get(
      "/me",
      this.jwt.verifyToken(process.env.JWT_SECRET!),
      this.controller.myTransactions
    );

    this.router.get(
      "/me/attended",
      this.jwt.verifyToken(process.env.JWT_SECRET!),
      this.controller.myAttendedEvents
    );

    this.router.post(
      "/",
      this.jwt.verifyToken(process.env.JWT_SECRET!),
      validateBody(CreateTransactionDTO),
      this.controller.create
    );

    this.router.post(
      "/:id/payment-proof",
      this.jwt.verifyToken(process.env.JWT_SECRET!),
      validateBody(UploadPaymentProofDTO),
      this.controller.uploadPaymentProof
    );

    // ORGANIZER
    this.router.patch(
      "/:id/accept",
      this.jwt.verifyToken(process.env.JWT_SECRET!),
      requireOrganizer,
      this.controller.accept
    );

    this.router.patch(
      "/:id/reject",
      this.jwt.verifyToken(process.env.JWT_SECRET!),
      requireOrganizer,
      this.controller.reject
    );
  }

  getRouter() {
    return this.router;
  }
}
