import { NextFunction, Request, Response } from "express";
import { verify, JwtPayload } from "jsonwebtoken";
import { ApiError } from "../utils/api-error";

type MyJwt = JwtPayload & { id?: number; role?: string };

export class JwtMiddleware {
  verifyToken = (secret: string) => {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        const auth = req.headers.authorization;
        if (!auth) throw new ApiError("Unauthorized", 401);

        const [type, token] = auth.split(" ");
        if (type !== "Bearer" || !token) throw new ApiError("Unauthorized", 401);

        const decoded = verify(token, secret) as MyJwt;

        if (!decoded?.id) throw new ApiError("Invalid token", 401);

        res.locals.user = {
          id: decoded.id,
          role: decoded.role,
        };

        return next();
      } catch (err: any) {
        if (err?.name === "TokenExpiredError") {
          return next(new ApiError("Token expired", 401));
        }
        return next(new ApiError("Invalid token", 401));
      }
    };
  };
}
