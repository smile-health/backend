import { BaseController } from "@smile-health/lib/base/controller.js"
import { ExcelMiddleware } from "@smile-health/lib/middlewares/excel.middleware.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { MicroplanningDashboardModule } from "./microplanning-dashboard.module.js"
import {
  BatchByMaterialIdParamsSchema,
  LocationTypeParamsSchema,
  TargetConsumptionQueriesSchema,
} from "./microplanning-dashboard.schema.js"

export class MicroplanningDashboardController extends BaseController {
  constructor(
    private readonly module: MicroplanningDashboardModule,
    private readonly excelMiddleware: ExcelMiddleware
  ) {
    super("ws_microplanning_dashboard")
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/target-consumption/:type/age",
      this.validateRequest("param", LocationTypeParamsSchema),
      this.validateRequest("query", TargetConsumptionQueriesSchema),
      async (c) => {
        const params = c.req.valid("param")
        const queries = c.req.valid("query")
        const response = await this.module.getTargetVsConsumption(
          c,
          params,
          queries
        )
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/target-consumption/:type/material",
      this.validateRequest("param", LocationTypeParamsSchema),
      this.validateRequest("query", TargetConsumptionQueriesSchema),
      async (c) => {
        const params = c.req.valid("param")
        const queries = c.req.valid("query")
        const response = await this.module.getMaterialTargetVsConsumption(
          c,
          params,
          queries
        )
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/target-consumption/:type/material/xls",
      this.validateRequest("param", LocationTypeParamsSchema),
      this.validateRequest("query", TargetConsumptionQueriesSchema),
      this.excelMiddleware.handleExport,
      async (c) => {
        const params = c.req.valid("param")
        const queries = c.req.valid("query")
        const file = await this.module.exportMaterialTargetVsConsumption(
          c,
          params,
          queries
        )
        c.set("file", file)
      }
    )

    router.get(
      "/total-target/:type",
      this.validateRequest("param", LocationTypeParamsSchema),
      this.validateRequest("query", TargetConsumptionQueriesSchema),
      async (c) => {
        const params = c.req.valid("param")
        const queries = c.req.valid("query")
        const response = await this.module.getTotalTarget(c, params, queries)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/batch",
      this.validateRequest("query", BatchByMaterialIdParamsSchema),
      async (c) => {
        const queries = c.req.valid("query")
        const response = await this.module.getBatchByMaterialId(c, queries)
        return c.json(response, StatusCodes.OK)
      }
    )

    return router
  }
}
