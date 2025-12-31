import { BaseController } from "@smile/lib/base/controller.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { MaterialSubtypeModule } from "./material-subtype.module.js"
import {
  GetListMaterialSubtypeQueries,
  GetListMaterialSubtypeSchema,
} from "./material-subtype.schema.js"

export class MaterialSubtypeController extends BaseController {
  constructor(private readonly module: MaterialSubtypeModule) {
    super("material_subtypes")
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/subtype",
      this.validateRequest("query", GetListMaterialSubtypeSchema),
      async (c) => {
        const reqQuery = c.req as {
          valid: (type: "query") => GetListMaterialSubtypeQueries
        }

        const queries = reqQuery.valid("query")
        const result = await this.module.list(c, queries)

        return c.json(result, StatusCodes.OK)
      }
    )

    return router
  }
}
