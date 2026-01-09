import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/api-error";

export const requireOrganizer = (_req: Request, res: Response, next: NextFunction) => {
  const role = res.locals.user?.role;
  if (role !== "ORGANIZER") throw new ApiError("Forbidden (organizer only)", 403);
  next();
};

export const requireCustomer = (_req: Request, res: Response, next: NextFunction) => {
  const role = res.locals.user?.role;
  if (role !== "CUSTOMER") throw new ApiError("Forbidden (customer only)", 403);
  next();
};
