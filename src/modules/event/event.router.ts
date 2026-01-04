import { Router } from "express";
import { JwtMiddleware } from "../../middlewares/jwt.middleware";
import { requireOrganizer } from "../../middlewares/role.middleware";
import { validateBody } from "../../middlewares/validation.middleware";
import { EventController } from "./event.controller";
import { CreateEventDTO } from "./dto/create-event.dto";
import { UpdateEventDTO } from "./dto/update-event.dto";
import { CreateVoucherDTO } from "./dto/create-voucher.dto";

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

    // organizer only
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

    // voucher promotion per-event (organizer only)
    this.router.post(
      "/:id/vouchers",
      this.jwt.verifyToken(process.env.JWT_SECRET!),
      requireOrganizer,
      validateBody(CreateVoucherDTO),
      this.controller.createVoucher
    );
  }

  getRouter() {
    return this.router;
  }
}
