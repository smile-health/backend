import { BaseController } from "@smile/lib/base/controller.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"

import {
  GetListMaterialSubstitutionSchema,
  SubmitMaterialSubstitutionSchema,
  SubstitutionIdSchema,
  QuerySchema,
} from "./annual-planning-material-substitution.schema.js"
import { IdParamsSchema } from "@smile/lib/types/param.js"
import type { AnnualPlanningMaterialSubstitutionModule } from "./annual-planning-material-substitution.module.js"
import { AnnualPlanningMaterialSubstitutionMiddleware } from "./annual-planning-material-susbstitution.middleware.js"
import { AnnualPlanningMaterialSubstitutionExport } from "./annual-planning-material-substitution.excel.js"
import { ExcelMiddleware } from "@smile/lib/middlewares"
export class AnnualPlanningMaterialSubstitutionController extends BaseController {
  constructor(
    private readonly module: AnnualPlanningMaterialSubstitutionModule,
    private readonly middleware: AnnualPlanningMaterialSubstitutionMiddleware,
    private readonly excelMiddleware: ExcelMiddleware
  ) {
    super("material_substitutions")
  }

  getRoutes(): Hono {
    const router = new Hono()

    /** START MAIN ROUTES */
    router.get(
      "/:id/material-substitutions",
      this.validateRequest("query", GetListMaterialSubstitutionSchema),
      this.validateRequest("param", IdParamsSchema),
      this.middleware.list,
      async (ctx) => {
        const params = ctx.req.valid("param")
        const paramQuery = ctx.req.valid("query")

        const { id: planId } = params
        const response = await this.module.list({
          context: ctx,
          params: paramQuery,
          id: planId,
        })
        return ctx.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/:id/material-substitutions/detail/:substitution_id",
      this.validateRequest("param", SubstitutionIdSchema),
      this.middleware.detail,
      async (c) => {
        const params = c.req.valid("param")
        const { id: planId, substitution_id: substitutionId } = params
        const response = await this.module.detail({
          context: c,
          params: { planId, substitutionId },
        })
        return c.json(response, StatusCodes.OK)
      }
    )

    router.post(
      "/:id/material-substitutions",
      this.validateRequest("json", SubmitMaterialSubstitutionSchema),
      this.validateRequest("param", IdParamsSchema),
      this.middleware.submit,
      async (c) => {
        const body = c.req.valid("json")
        const params = c.req.valid("param")

        const { id: planId } = params
        await this.module.submit({
          context: c,
          params: { planId },
          body,
        })
        return c.json({ success: true }, StatusCodes.CREATED)
      }
    )

    router.put(
      "/:id/material-substitutions/:substitution_id",
      this.validateRequest("json", SubmitMaterialSubstitutionSchema),
      this.validateRequest("param", SubstitutionIdSchema),
      this.middleware.submit,
      async (c) => {
        const body = c.req.valid("json")
        const params = c.req.valid("param")

        const { id: planId, substitution_id: substitutionId } = params
        await this.module.submit({
          context: c,
          params: { planId, substitutionId },
          body,
        })
        return c.json({ success: true }, StatusCodes.OK)
      }
    )

    router.delete(
      "/:id/material-substitutions/:substitution_id",
      this.validateRequest("param", SubstitutionIdSchema),
      this.middleware.delete,
      async (c) => {
        const params = c.req.valid("param")
        const { id: planId, substitution_id: substitutionId } = params
        await this.module.delete({
          context: c,
          params: { planId, substitutionId },
        })
        return c.json({ success: true }, StatusCodes.OK)
      }
    )
    /** END MAIN ROUTES */

    /** START EXPORT IMPORT ROUTES */
    router.get(
      "/:id/material-substitutions/export",
      this.validateRequest("param", IdParamsSchema),
      this.middleware.programPlanExistance,
      this.excelMiddleware.handleExport,
      async (c) => {
        const params = c.req.valid("param")
        const { id: planId } = params
        const file = await this.module.export({
          context: c,
          params: { planId },
        })
        return c.set("file", file)
      }
    )

    router.get(
      "/:id/material-substitutions/template",
      this.validateRequest("param", IdParamsSchema),
      this.middleware.programPlanExistance,
      async (c) => {
        const { id: planId } = c.req.valid("param")
        const file = await this.module.template({
          ctx: c,
          params: { planId },
        })
        return this.downloadExcel(c, file)
      }
    )

    router.post(
      "/:id/material-substitutions/import",
      this.validateRequest("param", IdParamsSchema),
      this.validateExcelRequest(
        this.middleware.import,
        new AnnualPlanningMaterialSubstitutionExport(),
        this.middleware.validateImport
      ),
      this.excelMiddleware.validateFileMiddleware,
      async (c) => {
        const rows = c.req.valid("json")
        const params = c.req.valid("param")
        const { id: planId } = params
        const response = await this.module.import({
          context: c,
          params: { planId },
          rows,
        })
        return c.json(response, StatusCodes.CREATED)
      }
    )

    /** START OPTIONS ROUTES */
    router.get(
      "/:id/planned-materials",
      this.validateRequest("param", IdParamsSchema),
      this.validateRequest("query", QuerySchema),
      this.middleware.list,
      async (c) => {
        const params = c.req.valid("param")
        const { id: planId } = params
        const queries = c.req.valid("query")
        const {
          exclude_ids: excludeIds,
          subtype_id: subtypeId,
          is_planned_only: isPlannedOnly,
          is_for_filter: isForFilter,
          ...otherQueries
        } = queries

        let excludeIdsArray: number[] | undefined
        if (excludeIds) {
          excludeIdsArray = excludeIds.split(",").map(Number)
        }

        const response = await this.module.materialTasks({
          context: c,
          params: {
            ...otherQueries,
            paginate: 10,
            excludeIds: excludeIdsArray,
            subtypeId: subtypeId ?? undefined,
            planId,
            isPlannedOnly,
            isForFilter,
          },
        })
        return c.json(response, StatusCodes.OK)
      }
    )
    /** END OPTIONS ROUTES */

    return router
  }
}
