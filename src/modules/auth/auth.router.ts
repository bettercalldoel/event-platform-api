import { Router } from "express";
import { validateBody } from "../../middlewares/validation.middleware";
import { AuthController } from "./auth.controller";
import { ForgotPasswordDTO } from "./dto/forgot-password.dto";
import { LoginDTO } from "./dto/login.dto";
import { RegisterDTO } from "./dto/register.dto";
import { ResetPasswordDTO } from "./dto/reset-password.dto";
import { JwtMiddleware } from "../../middlewares/jwt.middleware";

export class AuthRouter {
  router: Router;
  authController: AuthController;
  jwtMiddleware: JwtMiddleware;

  constructor() {
    this.router = Router();
    this.authController = new AuthController();
    this.jwtMiddleware = new JwtMiddleware();
    this.initRoutes();
  }

  private initRoutes = () => {
    this.router.post("/register", validateBody(RegisterDTO), this.authController.register);
    this.router.post("/login", validateBody(LoginDTO), this.authController.login);

    // ✅ for protected route frontend
    this.router.get("/me", this.jwtMiddleware.verifyToken(process.env.JWT_SECRET!), this.authController.me);

    this.router.post("/forgot-password", validateBody(ForgotPasswordDTO), this.authController.forgotPassword);

    this.router.post(
      "/reset-password",
      this.jwtMiddleware.verifyToken(process.env.JWT_SECRET_RESET!),
      validateBody(ResetPasswordDTO),
      this.authController.resetPassword
    );
  };

  getRouter = () => this.router;
}
