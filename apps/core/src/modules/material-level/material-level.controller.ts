import { RoleValidationMiddleware } from "@/common/middlewares/role-validation.middleware.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { BaseController } from "../base.controller.js"
import { MaterialLevelModule } from "./material-level.module.js"
import { GetMaterialLevelsQueryParamsSchema } from "./material-level.schema.js"

export class MaterialLevelController extends BaseController {
  constructor(
    private readonly module: MaterialLevelModule,
    private readonly roleValidationMiddleware: RoleValidationMiddleware
  ) {
    super()
  }

  getRoutes(): Hono {    
    const router = new Hono()

    router.get(
      "/",
      this.validateRequest("query", GetMaterialLevelsQueryParamsSchema),
      async (c) => {
        const queryParam = c.req.valid("query")
        const response = await this.module.list(c, queryParam)
        return c.json(response, StatusCodes.OK)
      }
    )

    return router
  }
}
