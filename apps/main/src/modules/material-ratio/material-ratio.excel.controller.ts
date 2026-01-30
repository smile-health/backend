import { BaseController } from "@smile-health/lib/base/controller.js"
import { ExcelMiddleware } from "@smile-health/lib/middlewares/index.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { MaterialRatioExcelMiddleware } from "./material-ratio.excel.middleware.js"
import { MaterialRatioExcelModule } from "./material-ratio.excel.module.js"
import {
  ExportMaterialRatioQueries,
  exportQueriesSchema,
  ImportRequestDTO,
} from "./material-ratio.excel.schema.js"
import {
  ProgramPlanParams,
  programPlanParamsSchema,
} from "./material-ratio.schema.js"

export class MaterialRatioExcelController extends BaseController {
  constructor(
    private readonly module: MaterialRatioExcelModule,
    private readonly excelMiddleware: ExcelMiddleware,
    private readonly materialRatioExcelMiddleware: MaterialRatioExcelMiddleware
  ) {
    super("material_ratio")
  }

  getRoutes() {
    const router = new Hono()

    router.get(
      "/material-ratio/template",
      this.excelMiddleware.handleExport,
      async (c) => {
        const file = await this.module.getExcelTemplate(c)
        c.set("file", file)
      }
    )

    router.get(
      "/:programPlanId/material-ratio/export",
      this.validateRequest("param", programPlanParamsSchema),
      this.validateRequest("query", exportQueriesSchema),
      this.excelMiddleware.handleExport,
      async (c) => {
        const { programPlanId } = c.req.valid("param") as ProgramPlanParams
        const queries = c.req.valid("query") as ExportMaterialRatioQueries

        const file = await this.module.export(c, programPlanId, queries)
        c.set("file", file)
      }
    )

    router.post(
      "/:programPlanId/material-ratio/import",
      this.validateRequest("param", programPlanParamsSchema),
      this.excelMiddleware.validateFileMiddleware,
      this.materialRatioExcelMiddleware.excel,
      async (c) => {
        const { programPlanId } = c.req.valid("param")
        const rows = c.req.valid("json") as ImportRequestDTO[]
        const result = await this.module.import(c, programPlanId, rows)

        return c.json(result, StatusCodes.OK)
      }
    )

    return router
  }
}
