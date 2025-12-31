import { Hono } from "hono"
import { BaseController } from "../base.controller"
import { TemperatureThresholdModule } from "./temperature-threshold.module"
import { GetTemperatureThresholdsQueryParamsSchema } from "./temperature-threshold.schema"
import { StatusCodes } from "http-status-codes"

export class TemperatureThresholdController extends BaseController {
  constructor(private readonly module: TemperatureThresholdModule) {
    super()
  }

  public getRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/",
      this.validateRequest("query", GetTemperatureThresholdsQueryParamsSchema),
      async (c) => {
        const query = c.req.valid("query")
        const response = await this.module.list(c, query)
        return c.json(response, StatusCodes.OK)
      }
    )

    return router
  }
}
