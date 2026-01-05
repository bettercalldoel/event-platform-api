import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/api-error";

export const requireOrganizer = (req: Request, res: Response, next: NextFunction) => {
  const role = String(res.locals.user?.role || "");
  if (role !== "ORGANIZER") throw new ApiError("Forbidden (Organizer only)", 403);
  next();
};

export const requireCustomer = (req: Request, res: Response, next: NextFunction) => {
  const role = String(res.locals.user?.role || "");
  if (role !== "CUSTOMER") throw new ApiError("Forbidden (Customer only)", 403);
  next();
};
