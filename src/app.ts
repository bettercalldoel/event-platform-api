import "reflect-metadata";
import cors from "cors";
import express, { Express } from "express";

import { PORT, FRONTEND_URLS } from "./config/env";
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
    const allowedOrigins = (FRONTEND_URLS || "http://localhost:3000")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    this.app.use(
      cors({
        origin: (origin, cb) => {
          // allow Postman/curl (tanpa header Origin)
          if (!origin) return cb(null, true);

          // allow origin yang ada di whitelist
          if (allowedOrigins.includes(origin)) return cb(null, true);

          return cb(new Error(`CORS blocked for origin: ${origin}`));
        },
        credentials: true, // hapus kalau kamu tidak pakai cookie/session
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
    // Railway inject process.env.PORT, dan sudah kita parse via PORT di env.ts
    this.app.listen(PORT, () => {
      console.log(`Server running on port : ${PORT}`);
      console.log(`Allowed origins: ${FRONTEND_URLS}`);
    });
  }
}
