import { BaseController } from "@smile-health/lib/base/controller.js"
import { ExcelMiddleware } from "@smile-health/lib/middlewares/excel.middleware.js"
import { Hono, type Context } from "hono"
import { StatusCodes } from "http-status-codes"
import { PopulationExcelMiddleware } from "./population.excel.middleware.js"
import { PopulationExcelModule } from "./population.excel.module.js"
import {
  ExportPopulationParams,
  ExportPopulationParamsSchema,
  ExportPopulationQueries,
  ExportPopulationQueriesSchema,
  ImportPopulationParams,
  ImportPopulationParamsSchema,
  PopulationImportRequestDTO,
} from "./population.excel.schema.js"

export class PopulationExcelController extends BaseController {
  constructor(
    private readonly module: PopulationExcelModule,
    private readonly excelMiddleware: ExcelMiddleware,
    private readonly populationExcelMiddleware: PopulationExcelMiddleware
  ) {
    super()
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/populations/template",
      this.excelMiddleware.handleExport,
      async (c) => this.#handleGetTemplate(c)
    )

    router.get(
      "/populations/export/:year{[0-9]+}",
      this.validateRequest("param", ExportPopulationParamsSchema),
      this.validateRequest("query", ExportPopulationQueriesSchema),
      this.excelMiddleware.handleExport,
      async (c) => this.#handleExport(c)
    )

    router.post(
      "/populations/import/:year{[0-9]+}",
      this.validateRequest("param", ImportPopulationParamsSchema),
      this.excelMiddleware.validateFileMiddleware,
      this.populationExcelMiddleware.excel,
      async (c) => this.#handleImport(c)
    )

    return router
  }

  async #handleGetTemplate(c: Context) {
    const file = await this.module.getExcelTemplate(c)
    c.set("file", file)
  }

  async #handleImport(c: Context) {
    const reqParam = c.req as {
      valid: (type: "param") => ImportPopulationParams
    }
    const reqJson = c.req as {
      valid: (type: "json") => PopulationImportRequestDTO[]
    }
    const { year } = reqParam.valid("param")
    const rows = reqJson.valid("json")
    const result = await this.module.import(c, year, rows)

    return c.json(result, StatusCodes.OK)
  }

  async #handleExport(c: Context) {
    const reqParam = c.req as {
      valid: (type: "param") => ExportPopulationParams
    }
    const reqQuery = c.req as {
      valid: (type: "query") => ExportPopulationQueries
    }

    const { year } = reqParam.valid("param")
    const { province_id } = reqQuery.valid("query")

    const file = await this.module.export(c, { year, province_id })
    c.set("file", file)
  }
}
