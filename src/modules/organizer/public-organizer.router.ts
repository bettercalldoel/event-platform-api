import { Router } from "express";
import { OrganizerController } from "./organizer.controller";

export class PublicOrganizerRouter {
  router: Router;
  controller: OrganizerController;

  constructor() {
    this.router = Router();
    this.controller = new OrganizerController();
    this.initRoutes();
  }

  private initRoutes() {
    this.router.get("/:id", this.controller.publicProfile);
  }

  getRouter() {
    return this.router;
  }
}
