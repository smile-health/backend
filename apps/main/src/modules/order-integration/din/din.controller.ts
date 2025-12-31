import { DB } from "@/common/infrastructure/database/types/db.js"
import { AuthKeycloakMiddleware } from "@/common/middlewares/auth.middleware.js"
import { OpenAPIHono } from "@hono/zod-openapi"
import { RequestMiddleware } from "@smile/lib/middlewares/request.middleware.js"
import { TransactionMiddleware } from "@smile/lib/middlewares/transaction.middleware.js"
import { StatusCodes } from "http-status-codes"
import { DinContext } from "./din.context.js"
import { DinMiddleware } from "./din.middleware.js"
import { DinModule } from "./din.module.js"
import { authLoginRoute, postPickingOrderRoute } from "./din.routes.js"
import { LoginRequestSchema } from "./din.schemas.js"

export class DinController {
  constructor(
    private readonly module: DinModule,
    private readonly middleware: DinMiddleware,
    private readonly reqMiddleware: RequestMiddleware,
    private readonly trxMiddleware: TransactionMiddleware<DB>,
    private readonly authMiddleware: AuthKeycloakMiddleware
  ) {}

  registerRoutes(app: OpenAPIHono) {
    const middlewares = [
      this.reqMiddleware.handle,
      this.trxMiddleware.handle,
      this.authMiddleware.handleAuthKeycloak,
      this.middleware.logRequest,
    ]

    app.use(authLoginRoute.getRoutingPath(), this.reqMiddleware.handle)
    app.openapi(authLoginRoute, async (c) => {
      const req = c.req.valid("form")
      const resp = await this.module.login(c, req)
      return c.json(resp, StatusCodes.OK)
    })
    app.use(postPickingOrderRoute.getRoutingPath(), ...middlewares)
    app.openapi(postPickingOrderRoute, async (c) => {
      const req = c.req.valid("json")
      const ctx = c as DinContext

      await this.middleware.validateRequest(ctx, req)
      await this.module.create(ctx, req)

      return c.json(
        {
          success: true,
          code: StatusCodes.OK,
          message: ctx.var.validate ? ctx.var.validate : "Success post data",
        },
        StatusCodes.OK
      )
    })
  }
}
