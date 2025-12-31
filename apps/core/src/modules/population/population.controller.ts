import { BaseController } from "@smile/lib/base/controller.js"
import { Hono, type Context } from "hono"
import { StatusCodes } from "http-status-codes"
import { PopulationModule } from "./population.module.js"
import {
  GetPopulationDetailParams,
  GetPopulationDetailParamsSchema,
  GetPopulationDetailQueries,
  GetPopulationDetailQueriesSchema,
  GetPopulationQueries,
  GetPopulationQueriesSchema,
} from "./population.schema.js"

export class PopulationController extends BaseController {
  constructor(private readonly module: PopulationModule) {
    super()
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/populations",
      this.validateRequest("query", GetPopulationQueriesSchema),
      async (c: Context) => {
        const req = c.req as {
          valid: (type: "query") => GetPopulationQueries
        }
        const query = req.valid("query")
        const result = await this.module.getPopulations(c, query)

        return c.json(result, StatusCodes.OK)
      }
    )

    router.get(
      "/populations/:year{[0-9]+}",
      this.validateRequest("param", GetPopulationDetailParamsSchema),
      this.validateRequest("query", GetPopulationDetailQueriesSchema),
      async (c: Context) => {
        const reqParam = c.req as {
          valid: (type: "param") => GetPopulationDetailParams
        }
        const reqQuery = c.req as {
          valid: (type: "query") => GetPopulationDetailQueries
        }
        const params = reqParam.valid("param")
        const query = reqQuery.valid("query")
        const result = await this.module.getPopulationDetail(c, params, query)

        return c.json(result, StatusCodes.OK)
      }
    )

    router.put(
      "/populations/:year{[0-9]+}",
      this.validateRequest("param", GetPopulationDetailParamsSchema),
      async (c: Context) => {
        const reqParam = c.req as {
          valid: (type: "param") => GetPopulationDetailParams
        }

        const params = reqParam.valid("param")
        await this.module.updatePopulationStatus(c, params.year)

        return c.body(null, StatusCodes.NO_CONTENT)
      }
    )

    return router
  }
}
