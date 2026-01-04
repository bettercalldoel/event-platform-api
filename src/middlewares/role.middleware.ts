import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/api-error";

export function requireOrganizer(req: Request, res: Response, next: NextFunction) {
  const role = res.locals.user?.role;
  if (role !== "ORGANIZER") throw new ApiError("Forbidden (Organizer only)", 403);
  next();
}

export function requireCustomer(req: Request, res: Response, next: NextFunction) {
  const role = res.locals.user?.role;
  if (role !== "CUSTOMER") throw new ApiError("Forbidden (Customer only)", 403);
  next();
}
