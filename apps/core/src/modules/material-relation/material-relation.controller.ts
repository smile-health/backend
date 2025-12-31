import { RoleValidationMiddleware } from "@/common/middlewares/role-validation.middleware.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { BaseController } from "../base.controller.js"
import { MaterialRelationModule } from "./material-relation.module.js"
import { GetMaterialRelationsQueryParamsSchema } from "./material-relation.schema.js"

export class MaterialRelationController extends BaseController {
  constructor(
    private readonly module: MaterialRelationModule,
    private readonly roleValidationMiddleware: RoleValidationMiddleware
  ) {
    super()
  }

  getRoutes(): Hono {    
    const router = new Hono()

    router.get(
      "/",
      this.validateRequest("query", GetMaterialRelationsQueryParamsSchema),
      async (c) => {
        const queryParam = c.req.valid("query")
        const response = await this.module.list(c, queryParam)
        return c.json(response, StatusCodes.OK)
      }
    )

    return router
  }
}
