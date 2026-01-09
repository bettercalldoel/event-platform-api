import { Request, Response } from "express";
import { AuthService } from "./auth.service";

export class AuthController {
  authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  register = async (req: Request, res: Response) => {
    const result = await this.authService.register(req.body);
    return res.status(200).send(result);
  };

  login = async (req: Request, res: Response) => {
    const result = await this.authService.login(req.body);
    return res.status(200).send(result);
  };

  me = async (_req: Request, res: Response) => {
    const authUserId = Number(res.locals.user.id);
    const result = await this.authService.me(authUserId);
    return res.status(200).send(result);
  };

  forgotPassword = async (req: Request, res: Response) => {
    const result = await this.authService.forgotPassword(req.body);
    return res.status(200).send(result);
  };

  resetPassword = async (req: Request, res: Response) => {
    const authUserId = Number(res.locals.user.id);
    const result = await this.authService.resetPassword(req.body, authUserId);
    return res.status(200).send(result);
  };

  changePassword = async (req: Request, res: Response) => {
    const authUserId = Number(res.locals.user.id);
    const result = await this.authService.changePassword(req.body, authUserId);
    return res.status(200).send(result);
  };

  referralSummary = async (_req: Request, res: Response) => {
    const authUserId = Number(res.locals.user.id);
    const result = await this.authService.referralSummary(authUserId);
    return res.status(200).send(result);
  };

  myCoupons = async (_req: Request, res: Response) => {
    const authUserId = Number(res.locals.user.id);
    const result = await this.authService.myCoupons(authUserId);
    return res.status(200).send(result);
  };
}
