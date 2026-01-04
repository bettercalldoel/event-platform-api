import "reflect-metadata";
import cors from "cors";
import express, { Express } from "express";
import { PORT } from "./config/env";
import { errorMiddleware } from "./middlewares/error.middleware";
import { AuthRouter } from "./modules/auth/auth.router";
import { EventRouter } from "./modules/event/event.router";
import { TransactionRouter } from "./modules/transaction/transaction.router";
import { initScheduler } from "./scripts";
import { UploadRouter } from "./modules/upload/upload.router";
import { OrganizerRouter } from "./modules/organizer/organizer.router";


export class App {
  app: Express;

  constructor() {
    this.app = express();
    this.configure();
    this.routes();
    this.handleError();
    initScheduler(); // ✅ auto expire & auto cancel
  }

  private configure() {
    this.app.use(
      cors({
        origin: process.env.FRONTEND_URL ?? "http://localhost:3000",
      })
    );
    this.app.use(express.json());
  }

  private routes() {
    this.app.get("/health", (_req, res) => res.status(200).json({ ok: true }));

    const authRouter = new AuthRouter();
    this.app.use("/auth", authRouter.getRouter());

    const eventRouter = new EventRouter();
    this.app.use("/events", eventRouter.getRouter());

    const trxRouter = new TransactionRouter();
    this.app.use("/transactions", trxRouter.getRouter());

    const uploadRouter = new UploadRouter();
    this.app.use("/uploads", uploadRouter.getRouter());

    const organizerRouter = new OrganizerRouter();
    this.app.use("/organizer", organizerRouter.getRouter());
  }

  private handleError() {
    this.app.use(errorMiddleware);
  }

  public start() {
    this.app.listen(PORT, () => {
      console.log(`Server running on port : ${PORT}`);
    });
  }
}
