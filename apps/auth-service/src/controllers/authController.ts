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

export class AuthController {
  public static registerRoutes(app: OpenAPIHono) {
    app.openapi(loginRoute, loginHandler);
    app.openapi(sendForgotPasswordEmailRoute, resetPasswordEmailHandler);
    app.openapi(validateTokenRoute, validateTokenHandler);
    app.openapi(logoutRoute, logoutHandler);
  }
}
