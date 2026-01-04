import { Router } from "express";
import { JwtMiddleware } from "../../middlewares/jwt.middleware";
import { requireOrganizer } from "../../middlewares/role.middleware";
import { OrganizerController } from "./organizer.controller";

export class OrganizerRouter {
  router: Router;
  jwt: JwtMiddleware;
  controller: OrganizerController;

  constructor() {
    this.router = Router();
    this.jwt = new JwtMiddleware();
    this.controller = new OrganizerController();
    this.initRoutes();
  }

  private initRoutes() {
    // organizer only
    this.router.get(
      "/events",
      this.jwt.verifyToken(process.env.JWT_SECRET!),
      requireOrganizer,
      this.controller.myEvents
    );

    // optional: kalau mau endpoint versi rapi untuk transaksi organizer
    this.router.get(
      "/transactions",
      this.jwt.verifyToken(process.env.JWT_SECRET!),
      requireOrganizer,
      this.controller.myTransactions
    );
  }

  getRouter() {
    return this.router;
  }
}
