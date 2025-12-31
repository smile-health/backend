import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { Context } from "hono"
import { AnnualPlanningMaterialSubstitutionRepository } from "./annual-planning-material-substitution.repository.js"
import {
  GetListMaterialSubstitutionQueries,
  TSubmitMaterialSubstitutionArgs,
  GetListMaterialForOptionQueries,
  ImportMaterialSubstitutionSchema,
} from "./annual-planning-material-substitution.schema.js"
import { AnnualPlanningMaterialSubstitutionExport } from "./annual-planning-material-substitution.excel.js"
import { PROCESSOR } from "@smile/lib/excel/types.js"
import { AnnualPlanningProgramPlanRepository } from "../annual-planning-program-plan/annual-planning-program-plan.repository.js"

export class AnnualPlanningMaterialSubstitutionModule {
  constructor(
    private readonly repository: AnnualPlanningMaterialSubstitutionRepository,
    private readonly programPlanRepo: AnnualPlanningProgramPlanRepository
  ) {}

  /** START MAIN MODULES */
  async list({
    context,
    params,
    id,
  }: {
    context: Context
    params: GetListMaterialSubstitutionQueries
    id: number
  }) {
    const { list, total } = await this.repository.getListMaterialSubstitution({
      context,
      params,
      id,
    })

    return new PaginatedResponse(params, list, total)
  }

  async detail({
    context,
    params,
  }: {
    context: Context
    params: { planId: number; substitutionId: number }
  }) {
    const substitution = await this.repository.getByIdForDetail({
      ctx: context,
      id: params.substitutionId,
      programPlanId: params.planId,
    })
    return substitution
  }

  async submit({
    context: ctx,
    params,
    body,
  }: TSubmitMaterialSubstitutionArgs) {
    const { user } = ctx.var

    const values = {
      ...body,
      program_plan_id: params.planId,
      created_by: Number(user?.global_id),
      updated_by: Number(user?.global_id),
    }
    await this.repository.submitMaterialSubstitution({
      context: ctx,
      values,
      paramSubstitutionId: params?.substitutionId ?? null,
    })
  }

  async delete({
    context: ctx,
    params,
  }: {
    context: Context
    params: { planId: number; substitutionId: number }
  }) {
    await this.repository.deleteMaterialSubstitution(ctx, params)
  }
  /** END MAIN MODULES */

  /** START EXPORT IMPORT MODULES */
  async export({
    context: ctx,
    params,
  }: {
    context: Context
    params: { planId: number; material_id?: number }
  }) {
    const START_FIRST_ROW = 1
    const START_SHEET = 1
    const { planId, material_id } = params
    const excelTemplate = new AnnualPlanningMaterialSubstitutionExport(
      START_FIRST_ROW,
      START_SHEET,
      PROCESSOR.EXCELJS
    )
    const title = ctx.var.t("annual_planning_material_substitution.export.name")
    const timezone = ctx.req.header("Timezone")

    const programPlans = await this.programPlanRepo.getProgramPlanMapped(ctx, [
      planId,
    ])
    const plan = programPlans[planId]
    const year = plan?.year

    excelTemplate.setTitle(year ? `${title} ${year}` : title)
    excelTemplate.setTimezone(timezone)
    excelTemplate.setLanguage(ctx.var.language)

    await excelTemplate.initSheet(title)

    excelTemplate.setColumns([
      {
        header: "No.",
        width: 8,
      },
      {
        header: ctx.var.t(
          "annual_planning_material_substitution.value.planned_material"
        ),
        width: 20,
      },
      {
        header: ctx.var.t(
          "annual_planning_material_substitution.label.planned_material"
        ),
        width: 20,
      },
      {
        header: ctx.var.t(
          "annual_planning_material_substitution.value.material_substitutions"
        ),
        width: 20,
      },
      {
        header: ctx.var.t(
          "annual_planning_material_substitution.label.material_substitutions"
        ),
        width: 20,
      },
      {
        header: ctx.var.t(
          "annual_planning_material_substitution.label.updated_at"
        ),
        width: 20,
      },
      {
        header: ctx.var.t(
          "annual_planning_material_substitution.label.updated_by"
        ),
        width: 20,
      },
    ])

    const data = await this.repository.getMaterialExport({
      context: ctx,
      params: { material_id },
      planId,
    })

    if (data.length <= 0) return await excelTemplate.generate()

    await excelTemplate.addRows(title, data)
    await excelTemplate.setRowFontBold(title, START_FIRST_ROW, "A")
    await excelTemplate.autoFitColumns(title)

    return await excelTemplate.generate()
  }

  async template({
    ctx,
    params,
  }: {
    ctx: Context
    params: { planId: number }
  }) {
    const excelTemplate = new AnnualPlanningMaterialSubstitutionExport()
    const { planId } = params
    excelTemplate.setTitle(
      ctx.var.t("annual_planning_material_substitution.template.name")
    )
    excelTemplate.setTimezone(ctx.req.header("Timezone"))
    excelTemplate.setLanguage(ctx.var.language)

    await excelTemplate.loadFile()

    const [plannedMaterialOptionssStream, materialSubstitutionOptionsStream] =
      await Promise.all([
        this.repository.getStreamMaterialOptions({
          ctx,
          planId,
          isPlannedOnly: true,
        }),
        this.repository.getStreamMaterialOptions({
          ctx,
          planId,
          isPlannedOnly: false,
        }),
      ])
    await excelTemplate.setPlannedMaterialOptions(plannedMaterialOptionssStream)
    await excelTemplate.setMaterialSubstitutionOptions(
      materialSubstitutionOptionsStream
    )

    return await excelTemplate.generate()
  }

  async import({ context, params, rows }) {
    return await this.repository.importMaterialSubstitution({
      context,
      params,
      rows: rows as ImportMaterialSubstitutionSchema[],
    })
  }
  /** END EXPORT IMPORT MODULES */

  /** START OPTIONS MODULES */
  async materialTasks({
    context: ctx,
    params,
  }: {
    context: Context
    params: GetListMaterialForOptionQueries & {
      subtypeId?: number
      excludeIds?: number[]
      planId: number
      isPlannedOnly?: boolean | null
      isForFilter?: boolean | null
    }
  }) {
    const result = await this.repository.getMaterialTasks({
      context: ctx,
      params,
    })

    if (!Array.isArray(result)) {
      const { list, total } = result
      return new PaginatedResponse(params, list, total)
    }

    return result
  }
  /** END OPTIONS MODULES */
}
