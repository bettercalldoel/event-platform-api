import { Router } from "express";
import { JwtMiddleware } from "../../middlewares/jwt.middleware";
import { requireOrganizer, requireCustomer } from "../../middlewares/role.middleware";
import { validateBody } from "../../middlewares/validation.middleware";
import { EventController } from "./event.controller";
import { CreateEventDTO } from "./dto/create-event.dto";
import { UpdateEventDTO } from "./dto/update-event.dto";
import { CreateVoucherDTO } from "./dto/create-voucher.dto";
import { UpdateVoucherDTO } from "./dto/update-voucher.dto";
import { CreateReviewDTO } from "./dto/create-review.dto";

export class EventRouter {
  router: Router;
  controller: EventController;
  jwt: JwtMiddleware;

  constructor() {
    this.router = Router();
    this.controller = new EventController();
    this.jwt = new JwtMiddleware();
    this.initRoutes();
  }

  private initRoutes() {
    // public
    this.router.get("/", this.controller.list);
    this.router.get("/:id", this.controller.detail);

    // reviews public list
    this.router.get("/:id/reviews", this.controller.listReviews);

    // customer create review
    this.router.post(
      "/:id/reviews",
      this.jwt.verifyToken(process.env.JWT_SECRET!),
      requireCustomer,
      validateBody(CreateReviewDTO),
      this.controller.createReview
    );

    // organizer only event CRUD
    this.router.post(
      "/",
      this.jwt.verifyToken(process.env.JWT_SECRET!),
      requireOrganizer,
      validateBody(CreateEventDTO),
      this.controller.create
    );

    this.router.patch(
      "/:id",
      this.jwt.verifyToken(process.env.JWT_SECRET!),
      requireOrganizer,
      validateBody(UpdateEventDTO),
      this.controller.update
    );

    // vouchers (organizer only)
    this.router.post(
      "/:id/vouchers",
      this.jwt.verifyToken(process.env.JWT_SECRET!),
      requireOrganizer,
      validateBody(CreateVoucherDTO),
      this.controller.createVoucher
    );

    this.router.get(
      "/:id/vouchers",
      this.jwt.verifyToken(process.env.JWT_SECRET!),
      requireOrganizer,
      this.controller.listVouchers
    );

    this.router.patch(
      "/:id/vouchers/:voucherId",
      this.jwt.verifyToken(process.env.JWT_SECRET!),
      requireOrganizer,
      validateBody(UpdateVoucherDTO),
      this.controller.updateVoucher
    );

    this.router.delete(
      "/:id/vouchers/:voucherId",
      this.jwt.verifyToken(process.env.JWT_SECRET!),
      requireOrganizer,
      this.controller.deleteVoucher
    );
  }

  getRouter() {
    return this.router;
  }
}
