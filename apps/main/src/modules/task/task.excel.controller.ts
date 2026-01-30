import { BaseController } from "@smile-health/lib/base/controller.js"
import { ExcelMiddleware } from "@smile-health/lib/middlewares/index.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { TaskExcelMiddleware } from "./task.excel.middleware.js"
import { TaskExcelModule } from "./task.excel.module.js"
import {
  ExportQueries,
  exportQueriesSchema,
  ImportParams,
  importParamsSchema,
  ImportRow,
} from "./task.excel.schema.js"

export class TaskExcelController extends BaseController {
  constructor(
    private readonly module: TaskExcelModule,
    private readonly excelMiddleware: ExcelMiddleware,
    private readonly taskExcelMiddleware: TaskExcelMiddleware
  ) {
    super("plan_tasks")
  }

  getRoutes() {
    const router = new Hono()

    router.get(
      "/task/template",
      this.excelMiddleware.handleExport,
      async (c) => {
        const file = await this.module.getExcelTemplate(c)
        c.set("file", file)
      }
    )

    router.get(
      "/:programPlanId/task/export",
      this.validateRequest("param", importParamsSchema),
      this.validateRequest("query", exportQueriesSchema),
      this.excelMiddleware.handleExport,
      async (c) => {
        const { programPlanId } = c.req.valid("param") as ImportParams
        const queries = c.req.valid("query") as ExportQueries

        const file = await this.module.export(c, programPlanId, queries)
        c.set("file", file)
      }
    )

    router.post(
      "/:programPlanId/task/import",
      this.validateRequest("param", importParamsSchema),
      this.excelMiddleware.validateFileMiddleware,
      this.taskExcelMiddleware.excel,
      async (c) => {
        const { programPlanId } = c.req.valid("param")
        const rows = c.req.valid("json") as ImportRow[]
        const result = await this.module.import(c, programPlanId, rows)

        return c.json(result, StatusCodes.OK)
      }
    )

    return router
  }
}
