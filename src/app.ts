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
    initScheduler(); // ✅ auto expire & auto cancel
  }

  private configure() {
    this.app.use(
      cors({
        origin: process.env.FRONTEND_URL ?? "http://localhost:3000",
        credentials: true,
      })
    );

    this.app.use(express.json({ limit: "2mb" }));
  }

  private routes() {
    // ✅ Health
    this.app.get("/health", (_req, res) => res.status(200).json({ ok: true }));

    // ✅ Auth
    const authRouter = new AuthRouter();
    this.app.use("/auth", authRouter.getRouter());

    // ✅ Events (public list/detail + organizer create/update + vouchers + reviews)
    const eventRouter = new EventRouter();
    this.app.use("/events", eventRouter.getRouter());

    // ✅ Transactions (customer create/upload proof + organizer accept/reject)
    const trxRouter = new TransactionRouter();
    this.app.use("/transactions", trxRouter.getRouter());

    // ✅ Uploads (Cloudinary signature)
    const uploadRouter = new UploadRouter();
    this.app.use("/uploads", uploadRouter.getRouter());

    // ✅ Organizer (dashboard routes + public organizer profile)
    const organizerRouter = new OrganizerRouter();

    // dashboard organizer: /organizer/events, /organizer/transactions
    this.app.use("/organizer", organizerRouter.getRouter());

    // public organizer profile: /organizers/:id
    this.app.use("/organizers", organizerRouter.getRouter());
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
