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
    // ✅ organizer only (dashboard)
    this.router.get(
      "/events",
      this.jwt.verifyToken(process.env.JWT_SECRET!),
      requireOrganizer,
      this.controller.myEvents
    );

    this.router.get(
      "/transactions",
      this.jwt.verifyToken(process.env.JWT_SECRET!),
      requireOrganizer,
      this.controller.myTransactions
    );

    // ✅ PUBLIC organizer profile (taruh PALING BAWAH biar nggak nangkep "/events")
    this.router.get("/:id", this.controller.profile);
  }

  getRouter() {
    return this.router;
  }
}
