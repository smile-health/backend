import { DB } from "@/common/infrastructure/database/types/db.js"
import { AuthKeycloakMiddleware } from "@/common/middlewares/auth.middleware.js"
import { OpenAPIHono } from "@hono/zod-openapi"
import { RequestMiddleware } from "@smile-health/lib/middlewares/request.middleware.js"
import { TransactionMiddleware } from "@smile-health/lib/middlewares/transaction.middleware.js"
import { StatusCodes } from "http-status-codes"
import { CommonModule } from "./common.module.js"
import {
  authLoginRoute,
  commonGetEntitiesRoute,
  commonGetEntityTagsRoute,
  commonGetProvincesRoute,
  commonGetRegenciesRoute,
  commonGetSubdistrictsRoute,
} from "./common.routes.js"

export class CommonController {
  constructor(
    private readonly module: CommonModule,
    private readonly reqMiddleware: RequestMiddleware,
    private readonly trxMiddleware: TransactionMiddleware<DB>,
    private readonly authMiddleware: AuthKeycloakMiddleware
  ) {}

  registerRoutes(app: OpenAPIHono) {
    const middlewares = [
      this.reqMiddleware.handle,
      this.trxMiddleware.handle,
      this.authMiddleware.handleAuthKeycloak,
    ]

    app.use(
      authLoginRoute.getRoutingPath(),
      this.reqMiddleware.handle,
      this.trxMiddleware.handle
    )
    app.openapi(authLoginRoute, async (c) => {
      const body = c.req.valid("json")
      const result = await this.module.login(c, body)
      return c.json(result, StatusCodes.OK)
    })

    app.use(commonGetEntitiesRoute.getRoutingPath(), ...middlewares)
    app.openapi(commonGetEntitiesRoute, async (c) => {
      const query = c.req.valid("query")
      const result = await this.module.getEntities(c, query)
      return c.json(result, StatusCodes.OK)
    })

    app.use(commonGetProvincesRoute.getRoutingPath(), ...middlewares)
    app.openapi(commonGetProvincesRoute, async (c) => {
      const query = c.req.valid("query")
      const result = await this.module.getProvinces(c, query)
      return c.json(result, StatusCodes.OK)
    })

    app.use(commonGetRegenciesRoute.getRoutingPath(), ...middlewares)
    app.openapi(commonGetRegenciesRoute, async (c) => {
      const query = c.req.valid("query")
      const result = await this.module.getRegencies(c, query)
      return c.json(result, StatusCodes.OK)
    })

    app.use(commonGetSubdistrictsRoute.getRoutingPath(), ...middlewares)
    app.openapi(commonGetSubdistrictsRoute, async (c) => {
      const query = c.req.valid("query")
      const result = await this.module.getSubdistricts(c, query)
      return c.json(result, StatusCodes.OK)
    })

    app.use(commonGetEntityTagsRoute.getRoutingPath(), ...middlewares)
    app.openapi(commonGetEntityTagsRoute, async (c) => {
      const query = c.req.valid("query")
      const result = await this.module.getEntityTags(c, query)
      return c.json(result, StatusCodes.OK)
    })
  }
}
