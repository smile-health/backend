import { DB } from "@/common/infrastructure/database/types/db.js"
import { ExcelMiddleware } from "@smile/lib/middlewares"
import { Consumer, TOPIC } from "@smile/lib/rabbitmq"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { BaseController } from "../base.controller.js"
import { BudgetSourceModule } from "./budget-source.module.js"
import {
  BudgetSourceSyncSchema,
  DetailSchema,
  GetBudgetSourceQueriesSchema,
} from "./budget-source.schema.js"

export class BudgetSourceController extends BaseController {
  constructor(
    private readonly module: BudgetSourceModule,
    private readonly excelMiddleware: ExcelMiddleware
  ) {
    super()
  }

  registerWorkers(consumer: Consumer<DB>) {
    consumer.route(TOPIC.BUDGET_SOURCE_CREATED, (c, msg) => {
      const jsonObject = JSON.parse(msg ?? "{}")
      this.module.syncData(c, BudgetSourceSyncSchema.parse(jsonObject))
    })

    consumer.route(TOPIC.BUDGET_SOURCE_UPDATED, (c, msg) => {
      const jsonObject = JSON.parse(msg ?? "{}")
      this.module.syncData(c, BudgetSourceSyncSchema.parse(jsonObject))
    })
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/xls",
      this.validateRequest("query", GetBudgetSourceQueriesSchema),
      this.excelMiddleware.handleExport,
      async (c) => {
        const query = c.req.valid("query")
        const file = await this.module.exportExcel(c, query)
        c.set("file", file)
      }
    )

    router.get(
      "/",
      this.validateRequest("query", GetBudgetSourceQueriesSchema),
      async (c) => {
        const query = c.req.valid("query")
        const rsp = await this.module.list(c, query)
        return c.json(rsp, StatusCodes.OK)
      }
    )

    router.get(
      "/:id",
      this.validateRequest("param", DetailSchema),
      async (c) => {
        const param = c.req.valid("param")
        const rsp = await this.module.detail(c, param.id)
        return c.json(rsp, StatusCodes.OK)
      }
    )

    return router
  }
}
