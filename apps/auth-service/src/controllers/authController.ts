import { OpenAPIHono } from "@hono/zod-openapi";
import {
  loginRoute,
  validateTokenRoute,
  logoutRoute,
  sendForgotPasswordEmailRoute,
} from "../routes/authRoutes";
import {
  loginHandler,
  validateTokenHandler,
  logoutHandler,
  resetPasswordEmailHandler,
} from "../route-handlers/authRouteHandlers";
import { createForgotPasswordRateLimiter } from "../middlewares/forgotPasswordRateLimiterMiddleware";

export class AuthController {
  public static registerRoutes(app: OpenAPIHono) {
    app.openapi(loginRoute, loginHandler);
    app.openapi(
      sendForgotPasswordEmailRoute,
      createForgotPasswordRateLimiter(),
      resetPasswordEmailHandler
    );
    app.openapi(validateTokenRoute, validateTokenHandler);
    app.openapi(logoutRoute, logoutHandler);
  }
}
