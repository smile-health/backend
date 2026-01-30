import { BaseController } from "@smile-health/lib/base/controller.js"
import { IdParamsSchema } from "@smile-health/lib/types/param.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { MaterialRatioMiddleware } from "./material-ratio.middleware.js"
import { MaterialRatioModule } from "./material-ratio.module.js"
import {
  ListQueries,
  ProgramPlanParams,
  UpdateInput,
  listQueriesSchema,
  programPlanParamsSchema,
} from "./material-ratio.schema.js"

export class MaterialRatioController extends BaseController {
  constructor(
    private readonly module: MaterialRatioModule,
    private readonly middleware: MaterialRatioMiddleware
  ) {
    super("material_ratio")
  }

  getRoutes() {
    const router = new Hono()

    router.get(
      "/:programPlanId/material-ratio",
      this.validateRequest("param", programPlanParamsSchema),
      this.validateRequest("query", listQueriesSchema),
      async (c) => {
        const { programPlanId } = c.req.valid("param") as ProgramPlanParams
        const queries = c.req.valid("query") as ListQueries
        const result = await this.module.list(c, programPlanId, queries)

        return c.json(result, StatusCodes.OK)
      }
    )

    router.get(
      "/material-ratio/:id",
      this.validateRequest("param", IdParamsSchema),
      async (c) => {
        const { id } = c.req.valid("param")
        const result = await this.module.getById(c, id)

        return c.json(result, StatusCodes.OK)
      }
    )

    router.post(
      "/material-ratio",
      this.validateRequest("json", this.middleware.create),
      async (c) => {
        const body = c.req.valid("json")
        await this.module.create(c, body)

        return c.body(null, StatusCodes.NO_CONTENT)
      }
    )

    router.put(
      "/material-ratio/:id",
      this.validateRequest("param", IdParamsSchema),
      this.validateRequest("json", this.middleware.update),
      async (c) => {
        const { id } = c.req.valid("param")
        const body = c.req.valid("json") as UpdateInput
        await this.module.update(c, id, body)

        return c.body(null, StatusCodes.NO_CONTENT)
      }
    )

    router.delete(
      "/material-ratio/:id",
      this.validateRequest("param", IdParamsSchema),
      async (c) => {
        const { id } = c.req.valid("param")
        await this.module.delete(c, id)

        return c.body(null, StatusCodes.NO_CONTENT)
      }
    )

    return router
  }
}
