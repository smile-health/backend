import { Hono, type Context } from "hono"
import { StatusCodes } from "http-status-codes"
import { BaseController } from "../base.controller.js"
import { PopulationModule } from "./population.module.js"
import {
  GetPopulationByProgramPlanParams,
  GetPopulationByProgramPlanParamsSchema,
  GetPopulationByProgramPlanQueries,
  GetPopulationByProgramPlanQueriesSchema,
} from "./population.schema.js"

export class PopulationController extends BaseController {
  constructor(private readonly module: PopulationModule) {
    super()
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/:id/population",
      this.validateRequest("param", GetPopulationByProgramPlanParamsSchema),
      this.validateRequest("query", GetPopulationByProgramPlanQueriesSchema),
      async (c) => this.#handleGetPopulationByProgramPlan(c)
    )

    return router
  }

  async #handleGetPopulationByProgramPlan(c: Context) {
    const reqParam = c.req as {
      valid: (type: "param") => GetPopulationByProgramPlanParams
    }
    const reqQuery = c.req as {
      valid: (type: "query") => GetPopulationByProgramPlanQueries
    }

    const params = reqParam.valid("param")
    const query = reqQuery.valid("query")

    const result = await this.module.getPopulationByProgramPlan(
      c,
      params,
      query
    )

    return c.json(result, StatusCodes.OK)
  }
}
