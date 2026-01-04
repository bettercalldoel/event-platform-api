import { Router } from "express";
import { JwtMiddleware } from "../../middlewares/jwt.middleware";
import { UploadController } from "./upload.controller";

export class UploadRouter {
  router: Router;
  jwt: JwtMiddleware;
  controller: UploadController;

  constructor() {
    this.router = Router();
    this.jwt = new JwtMiddleware();
    this.controller = new UploadController();
    this.initRoutes();
  }

  private initRoutes() {
    // endpoint yang dipanggil FE: POST /uploads/signature
    this.router.post(
      "/signature",
      this.jwt.verifyToken(process.env.JWT_SECRET!),
      this.controller.getSignature
    );
  }

  getRouter() {
    return this.router;
  }
}
