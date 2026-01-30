import { BaseController } from "@smile-health/lib/base/controller.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { AnnualPlanningGroupTargetModule } from "./annual-planning-group-target.module.js"
import {
  GetListGroupTargetSchema,
  ImportTargetGroupRequestSchema,
  SubmitGroupTargetSchema,
  UpdateGroupTargetParamSchema,
  UpdateGroupTargetSchema,
} from "./annual-planning-group-target.schema.js"
import { AnnualPlanningGroupTargetMiddleware } from "./annual-planning-group-target.middleware.js"
import { ExcelMiddleware } from "@smile-health/lib/middlewares/excel.middleware.js"
import { AnnualPlanningGroupTargetExcel } from "./annual-planning-group-target.excel.js"

export class AnnualPlanningGroupTargetController extends BaseController {
  constructor(
    private readonly module: AnnualPlanningGroupTargetModule,
    private readonly middleware: AnnualPlanningGroupTargetMiddleware,
    private readonly excelMiddleware: ExcelMiddleware
  ) {
    super("annual_planning_group_target")
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/group-targets/export",
      this.validateRequest("query", GetListGroupTargetSchema),
      this.excelMiddleware.handleExport,
      async (c) => {
        const paramQuery = c.req.valid("query")
        const file = await this.module.export(c, paramQuery)

        c.set("file", file)
      }
    )

    router.post(
      "/group-targets/import",
      this.excelMiddleware.validateFileMiddleware,
      this.validateExcelRequest(
        ImportTargetGroupRequestSchema,
        new AnnualPlanningGroupTargetExcel(),
        this.middleware.validateImport
      ),
      async (c) => {
        const rows = c.req.valid("json")
        const response = await this.module.import(c, rows)

        return c.json(response, StatusCodes.CREATED)
      }
    )

    router.get(
      "/group-targets/template",
      this.validateRequest("query", GetListGroupTargetSchema),
      this.excelMiddleware.handleExport,
      async (c) => {
        const file = await this.module.template(c)

        c.set("file", file)
      }
    )

    router.get(
      "/group-targets",
      this.validateRequest("query", GetListGroupTargetSchema),
      async (c) => {
        const paramQuery = c.req.valid("query")
        const response = await this.module.list(c, paramQuery)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.put(
      "/group-targets/:id",
      this.validateRequest("param", UpdateGroupTargetParamSchema),
      this.validateRequest(
        "json",
        UpdateGroupTargetSchema,
        this.middleware.update
      ),
      async (c) => {
        const body = c.req.valid("json")
        const param = c.req.valid("param")
        const response = await this.module.update(c, Number(param.id), body)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.post(
      "/group-targets",
      this.validateRequest(
        "json",
        SubmitGroupTargetSchema,
        this.middleware.submit
      ),
      async (c) => {
        const body = c.req.valid("json")
        const response = await this.module.submit(c, body)
        return c.json(response, StatusCodes.OK)
      }
    )

    return router
  }
}
