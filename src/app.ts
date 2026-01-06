import "reflect-metadata";
import cors from "cors";
import express, { Express } from "express";
import { PORT } from "./config/env";
import { errorMiddleware } from "./middlewares/error.middleware";

import { AuthRouter } from "./modules/auth/auth.router";
import { EventRouter } from "./modules/event/event.router";
import { TransactionRouter } from "./modules/transaction/transaction.router";
import { UploadRouter } from "./modules/upload/upload.router";
import { OrganizerRouter } from "./modules/organizer/organizer.router";

import { initScheduler } from "./scripts";

export class App {
  app: Express;

  constructor() {
    this.app = express();
    this.configure();
    this.routes();
    this.handleError();
    initScheduler();
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

    this.app.use("/auth", new AuthRouter().getRouter());
    this.app.use("/events", new EventRouter().getRouter());
    this.app.use("/transactions", new TransactionRouter().getRouter());
    this.app.use("/uploads", new UploadRouter().getRouter());
    this.app.use("/organizer", new OrganizerRouter().getRouter());
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
