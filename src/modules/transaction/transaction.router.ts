import { Router } from "express";
import { JwtMiddleware } from "../../middlewares/jwt.middleware";
import { requireCustomer, requireOrganizer } from "../../middlewares/role.middleware";
import { validateBody } from "../../middlewares/validation.middleware";
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
    // customer
    this.router.post(
      "/",
      this.jwt.verifyToken(process.env.JWT_SECRET!),
      requireCustomer,
      validateBody(CreateTransactionDTO),
      this.controller.create
    );

    this.router.get(
      "/me",
      this.jwt.verifyToken(process.env.JWT_SECRET!),
      requireCustomer,
      this.controller.me
    );

    this.router.post(
      "/:id/payment-proof",
      this.jwt.verifyToken(process.env.JWT_SECRET!),
      requireCustomer,
      validateBody(UploadPaymentProofDTO),
      this.controller.uploadProof
    );

    // organizer
    this.router.get(
      "/organizer",
      this.jwt.verifyToken(process.env.JWT_SECRET!),
      requireOrganizer,
      this.controller.organizerList
    );

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
