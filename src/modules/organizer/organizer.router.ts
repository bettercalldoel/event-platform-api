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
    // Semua route di bawah ini hanya untuk ORGANIZER
    const auth = this.jwt.verifyToken(process.env.JWT_SECRET!);

    // My events
    this.router.get("/events", auth, requireOrganizer, this.controller.myEvents);

    // My transactions
    this.router.get(
      "/transactions",
      auth,
      requireOrganizer,
      this.controller.myTransactions
    );

    // Attendees list per event
    this.router.get(
      "/events/:eventId/attendees",
      auth,
      requireOrganizer,
      this.controller.attendees
    );

    // Stats (year / month / day)
    this.router.get("/stats", auth, requireOrganizer, this.controller.stats);
  }

  getRouter() {
    return this.router;
  }
}
