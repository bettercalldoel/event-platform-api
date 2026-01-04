import { NextFunction, Request, Response } from "express";

export function requireOrganizer(_req: Request, res: Response, next: NextFunction) {
  const user = res.locals.user;
  if (!user) return res.status(401).json({ message: "Unauthorized" });
  if (user.role !== "ORGANIZER") return res.status(403).json({ message: "Organizer only" });
  next();
}

export function requireCustomer(_req: Request, res: Response, next: NextFunction) {
  const user = res.locals.user;
  if (!user) return res.status(401).json({ message: "Unauthorized" });
  if (user.role !== "CUSTOMER") return res.status(403).json({ message: "Customer only" });
  next();
}
