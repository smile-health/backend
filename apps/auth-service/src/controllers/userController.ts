import { OpenAPIHono } from "@hono/zod-openapi";
import {
  createUserRoute,
  updateUserRoute,
  deleteUserRoute,
  getUserRoute,
  sendUpdatePasswordEmailRoute,
} from "../routes/userRoutes";
import {
  createUserHandler,
  updateUserHandler,
  deleteUserHandler,
  getUserHandler,
  updatePasswordEmailHandler,
} from "../route-handlers/userRouteHandlers";

export class UserController {
  public static registerRoutes(app: OpenAPIHono) {
    app.openapi(createUserRoute, createUserHandler);
    app.openapi(getUserRoute, getUserHandler);
    app.openapi(updateUserRoute, updateUserHandler);
    app.openapi(deleteUserRoute, deleteUserHandler);
    app.openapi(sendUpdatePasswordEmailRoute, updatePasswordEmailHandler);
  }
}
