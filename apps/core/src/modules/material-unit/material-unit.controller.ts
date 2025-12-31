import { RoleValidationMiddleware } from "@/common/middlewares/role-validation.middleware.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { BaseController } from "../base.controller.js"
import { MaterialUnitModule } from "./material-unit.module.js"
import { GetMaterialUnitsQueryParamsSchema } from "./material-unit.schema.js"

export class MaterialUnitController extends BaseController {
  constructor(
    private readonly module: MaterialUnitModule,
    private readonly roleValidationMiddleware: RoleValidationMiddleware
  ) {
    super()
  }

  getRoutes(): Hono {    
    const router = new Hono()

    router.get(
      "/",
      this.validateRequest("query", GetMaterialUnitsQueryParamsSchema),
      async (c) => {
        const queryParam = c.req.valid("query")
        const response = await this.module.list(c, queryParam)
        return c.json(response, StatusCodes.OK)
      }
    )

    return router
  }
}
