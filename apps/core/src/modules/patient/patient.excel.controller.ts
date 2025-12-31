import { BaseController } from "@smile/lib/base/controller.js"
import { ExcelMiddleware } from "@smile/lib/middlewares/excel.middleware.js"
import { Hono, type Context } from "hono"
import { StatusCodes } from "http-status-codes"
import { PatientExcelMiddleware } from "./patient.excel.middleware.js"
import { PatientExcelModule } from "./patient.excel.module.js"
import {
  GetImportLogQueries,
  GetImportLogQueriesSchema,
  PatientImportRequestDTO,
} from "./patient.excel.schema.js"

export class PatientExcelController extends BaseController {
  constructor(
    private readonly module: PatientExcelModule,
    private readonly excelMiddleware: ExcelMiddleware,
    private readonly patientExcelMiddleware: PatientExcelMiddleware
  ) {
    super()
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.get("/xls-template", this.excelMiddleware.handleExport, async (c) =>
      this.#handleGetTemplate(c)
    )

    router.get(
      "/import-log",
      this.validateRequest("query", GetImportLogQueriesSchema),
      async (c) => this.#handleGetImportLog(c)
    )

    router.post(
      "/xls",
      this.excelMiddleware.validateFileMiddleware,
      this.patientExcelMiddleware.logErrors,
      this.patientExcelMiddleware.excel,
      async (c) => this.#handleImport(c)
    )

    return router
  }

  async #handleGetTemplate(c: Context) {
    const file = await this.module.getExcelTemplate(c)
    c.set("file", file)
  }

  async #handleGetImportLog(c: Context) {
    const req = c.req as unknown as {
      valid: (type: "query") => GetImportLogQueries
    }
    const query = req.valid("query")
    const response = await this.module.getImportLog(c, query)

    return c.json(response, StatusCodes.OK)
  }

  async #handleImport(c: Context) {
    const req = c.req as unknown as {
      valid: (type: "json") => PatientImportRequestDTO[]
    }
    const rows = req.valid("json")
    const result = await this.module.import(c, rows)
    await this.module.logImport(c)

    return c.json(result, StatusCodes.OK)
  }
}
