import { RoleValidationMiddleware } from "@/common/middlewares/role-validation.middleware.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { BaseController } from "../base.controller.js"
import { MaterialTypeModule } from "./material-type.module.js"
import { GetMaterialTypesQueryParamsSchema } from "./material-type.schema.js"

export class MaterialTypeController extends BaseController {
  constructor(
    private readonly module: MaterialTypeModule,
    private readonly roleValidationMiddleware: RoleValidationMiddleware
  ) {
    super()
  }

  getRoutes(): Hono {    
    const router = new Hono()

    router.get(
      "/",
      this.validateRequest("query", GetMaterialTypesQueryParamsSchema),
      async (c) => {
        const queryParam = c.req.valid("query")
        const response = await this.module.list(c, queryParam)
        return c.json(response, StatusCodes.OK)
      }
    )

    return router
  }
}
