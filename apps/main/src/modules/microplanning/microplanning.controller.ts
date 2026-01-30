import { BaseController } from "@smile-health/lib/base/controller.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { MicroplanningModule } from "./microplanning.module.js"
import { MicroplanningStepsQuerySchema } from "./microplanning.schema.js"

export class MicroplanningController extends BaseController {
  constructor(private readonly module: MicroplanningModule) {
    super()
  }

  readonly #getSubDistrictId = (c: any) =>
    Number(c.var.userEntity?.sub_district_id || 0)

  readonly #getEntityId = (c: any) => Number(c.var.userEntity?.global_id)

  getRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/steps",
      this.validateRequest("query", MicroplanningStepsQuerySchema),
      async (c) => {
        const { category } = c.req.valid("query")
        const result = await this.module.getMicroplanningSteps(
          c,
          this.#getSubDistrictId(c),
          this.#getEntityId(c),
          category
        )
        return c.json(result, StatusCodes.OK)
      }
    )

    router.post("/submit", async (c) => {
      const result = await this.module.submitMicroplanning(
        c,
        this.#getSubDistrictId(c),
        this.#getEntityId(c)
      )
      return c.json(result, StatusCodes.OK)
    })

    return router
  }
}
