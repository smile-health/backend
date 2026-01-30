import { ValidationError } from "@smile-health/lib/error.js"
import { Context } from "hono"
import BaseTemplate from "@smile-health/lib/excel/index.js"
import { collect } from "@smile-health/lib/utils.js"
import { AnnualPlanningMaterialSubstitutionRepository } from "./annual-planning-material-substitution.repository.js"
import {
  SubmitMaterialSubstitutionRequest,
  ColumnImportSchema,
  ImportMaterialSubstitutionSchema,
  ImportMaterialSubstitutionRequestSchema,
} from "./annual-planning-material-substitution.schema.js"
import { BaseMiddleware } from "@smile-health/lib/base/middleware.js"
import { createMiddleware } from "hono/factory"

export class AnnualPlanningMaterialSubstitutionMiddleware extends BaseMiddleware {
  constructor(
    private readonly repository: AnnualPlanningMaterialSubstitutionRepository
  ) {
    super()
  }

  checkPlanExistance = async ({
    ctx,
    planId,
  }: {
    ctx: Context
    planId: number
  }) => {
    const checkPlanStatus = await this.repository.getStatusOfProgramPlan({
      ctx,
      planId: Number(planId),
    })
    if (!checkPlanStatus) {
      throw new ValidationError(ctx.var.t("validator.program_plan_not_found"))
    }
  }

  list = createMiddleware(async (ctx: Context, next: () => Promise<void>) => {
    const programId = ctx.var?.programId
    const { id: planId } = ctx.req.param()

    if (!programId) {
      throw new ValidationError(
        ctx.var.t("validator.invalid_program_id_required_for_request")
      )
    }

    await this.checkPlanExistance({
      ctx,
      planId: Number(planId),
    })

    await next()
  })

  detail = createMiddleware(async (ctx: Context, next: () => Promise<void>) => {
    const param = ctx.req.param()
    const { id: planId, substitution_id: substitutionId } = param

    await this.checkPlanExistance({
      ctx,
      planId: Number(planId),
    })

    const substitution = await this.repository.getById({
      ctx,
      id: Number(substitutionId),
      programPlanId: Number(planId),
    })

    if (!substitution) {
      throw new ValidationError(
        ctx.var.t("validator.invalid_material_substitution_not_found", {
          material_substitution_id: substitutionId,
        })
      )
    }
    await next()
  })

  submit = createMiddleware(async (ctx: Context, next: () => Promise<void>) => {
    const body = await ctx.req.json<SubmitMaterialSubstitutionRequest>()
    const param = ctx.req.param()
    const { material_id, substitution_material_ids } = body
    const { id: planId, substitution_id: substitutionId } = param

    const programId = ctx.var?.programId
    if (!programId) {
      throw new ValidationError(
        ctx.var.t("validator.invalid_program_id_required_for_request")
      )
    }

    await this.checkPlanExistance({
      ctx,
      planId: Number(planId),
    })

    const materialExistsInMaster = await this.repository.checkMaterialExists({
      ctx,
      materialIds: [material_id],
      programPlanId: Number(planId),
      isMaterialTask: true,
    })

    const materialIsAlreadyStored =
      await this.repository.getExistingSubstitutions({
        ctx,
        materialIds: [material_id],
        programPlanId: Number(planId),
        excludeDeleted: false,
      })

    if (
      materialExistsInMaster.length === 0 &&
      materialIsAlreadyStored.length === 0
    ) {
      ctx.addError(
        "material_id",
        "validator.invalid_material_substitution_material_not_found"
      )
    }

    const substitutionMaterialsExistInMaster =
      await this.repository.getMaterialsForSubstitutionsForChecking({
        context: ctx,
        materialId: material_id,
        materialSubstitutionIds: substitution_material_ids,
      })

    const mappedSubstitutionMaterialsExistInMaster =
      substitutionMaterialsExistInMaster.map((item) => Number(item.id))

    const materialSubstitutionIsAlreadyStored = materialIsAlreadyStored
      ?.map((item) => Number(item?.substitution_material_id))
      ?.filter((id) => substitution_material_ids.includes(Number(id)))

    for (const [idx, id] of substitution_material_ids.entries()) {
      const existsInMaster = mappedSubstitutionMaterialsExistInMaster.includes(
        Number(id)
      )
      const existsInStored = materialSubstitutionIsAlreadyStored.includes(
        Number(id)
      )
      if (!existsInMaster && !existsInStored) {
        ctx.addError(
          `substitution_material_ids.${idx}`,
          "validator.invalid_material_substitution_material_substitution_not_found"
        )
      }
    }

    if (ctx.req.method === "POST" || !substitutionId) {
      const existingSubstitutions =
        await this.repository.getExistingSubstitutions({
          ctx,
          materialIds: [material_id],
          programPlanId: Number(planId),
          excludeDeleted: true,
        })

      if (existingSubstitutions.length > 0) {
        ctx.addError(
          "material_id",
          "validator.invalid_material_substitution_already_exists"
        )
      }
    }

    const materialIdInsideSubstitution =
      substitution_material_ids.indexOf(material_id)

    if (materialIdInsideSubstitution !== -1) {
      ctx.addError(
        `substitution_material_ids.${materialIdInsideSubstitution}`,
        "validator.invalid_material_substitution_cannot_self_substitute"
      )
    }

    if (ctx.var.errors) {
      throw new ValidationError()
    }

    await next()
  })

  delete = createMiddleware(async (ctx: Context, next: () => Promise<void>) => {
    const param = ctx.req.param()
    const { id: planId, substitution_id: substitutionId } = param

    await this.checkPlanExistance({
      ctx,
      planId: Number(planId),
    })

    const substitution = await this.repository.getById({
      ctx,
      id: Number(substitutionId),
      programPlanId: Number(planId),
    })
    if (!substitution) {
      throw new ValidationError(
        ctx.var.t("validator.invalid_material_substitution_not_found", {
          material_substitution_id: substitutionId,
        })
      )
    }
    await next()
  })

  programPlanExistance = createMiddleware(
    async (ctx: Context, next: () => Promise<void>) => {
      const programId = ctx.var?.programId
      const { id: planId } = ctx.req.param()
      if (!programId) {
        throw new ValidationError(
          ctx.var.t("validator.invalid_program_id_required_for_request")
        )
      }
      await this.checkPlanExistance({
        ctx,
        planId: Number(planId),
      })
      await next()
    }
  )

  readonly #getColumnTranslations = (c: Context): ColumnImportSchema => ({
    MaterialId: c.var.t(
      "annual_planning_material_substitution.value.planned_material"
    ),
    SubstitutionId: c.var.t(
      "annual_planning_material_substitution.value.material_substitutions"
    ),
  })

  import = (c: Context) => {
    const inputtedCol: ColumnImportSchema = this.#getColumnTranslations(c)
    return ImportMaterialSubstitutionRequestSchema(inputtedCol)
  }
  validateImport = async (
    c: Context,
    rows: ImportMaterialSubstitutionSchema[],
    template: BaseTemplate
  ) => {
    const startRow = template.getStartRow()
    const { id } = c.req.param()

    await this.checkPlanExistance({
      ctx: c,
      planId: Number(id),
    })

    const copyOfRows = rows?.map((row) => ({
      material_id: row.MaterialId,
      substitution_material_id: row.SubstitutionId,
      row_number: rows.indexOf(row) + startRow,
    }))

    const elaboratedRows = copyOfRows.flatMap((item) =>
      item.substitution_material_id?.map((id) => ({
        ...item,
        material_id: item.material_id,
        substitution_material_id: id,
      }))
    )

    // if material_id of copyOfRows exists in ws_material_substitutions, throw error
    const existingMaterials = await this.repository.getExistingSubstitutions({
      ctx: c,
      materialIds: collect(copyOfRows, "material_id"),
      programPlanId: Number(id),
      excludeDeleted: true,
    })
    const existingMaterialIds = collect(existingMaterials, "material_id")
    for (const item of copyOfRows) {
      if (existingMaterialIds.includes(item.material_id)) {
        c.addError(
          item?.row_number.toString(),
          "validator.invalid_material_substitution_already_exists",
          this.#getColumnTranslations(c).MaterialId
        )
      }
    }

    // If material_id of copyOfRows duplicated in rows, throw error
    const materialIdsArr = collect(copyOfRows, "material_id")
    const duplicatedMaterialIds = materialIdsArr.filter(
      (item, index) => materialIdsArr.indexOf(item) !== index
    )

    if (duplicatedMaterialIds.length > 0) {
      for (const dupId of duplicatedMaterialIds) {
        const rowNumbers = copyOfRows
          .filter((row) => row.material_id === dupId)
          .map((row) => row.row_number)
        for (const rowNum of rowNumbers) {
          c.addError(
            rowNum.toString(),
            "validator.duplicated",
            this.#getColumnTranslations(c).MaterialId
          )
        }
      }
    }

    const mappedElaboratedRows = Object.values(
      elaboratedRows.reduce(
        (
          acc: Record<
            number,
            { material_id: number; substitutions: number[]; row_number: number }
          >,
          { material_id, ...rest }
        ) => {
          acc[material_id] ??= {
            material_id,
            substitutions: [],
            row_number: rest.row_number,
          }
          acc[material_id].substitutions.push(rest.substitution_material_id)
          return acc
        },
        {}
      )
    )

    for (const item of mappedElaboratedRows) {
      const seen = new Set()
      const duplicates = item.substitutions.filter((id) => {
        if (seen.has(id)) return true
        seen.add(id)
        return false
      })

      if (duplicates.length > 0) {
        const col = this.#getColumnTranslations(c).SubstitutionId
        const row = item.row_number.toString()

        duplicates.map(() => c.addError(row, "validator.duplicated", col))
      }
    }

    // check material_id existence
    const materials = (await this.repository.getMaterialTasks({
      context: c,
      ids: collect(copyOfRows, "material_id"),
    })) as Array<{ id: number }>

    const materialIds = collect(materials, "id")
    for (const item of copyOfRows) {
      if (!materialIds.includes(item.material_id)) {
        c.addError(
          item?.row_number.toString(),
          "validator.make_sure_material_id_exists_in_planned_material_list",
          this.#getColumnTranslations(c).MaterialId
        )
      }

      // check substitution_material_id existence
      const materialSubstitutionIds = collect(
        elaboratedRows.filter((sub) => sub.material_id === item.material_id),
        "substitution_material_id"
      )
      const substitutions =
        await this.repository.getMaterialsForSubstitutionsForChecking({
          context: c,
          materialId: item.material_id,
          materialSubstitutionIds,
        })
      const substitutionIds = collect(substitutions, "id")
      // If substitution_material_id length not equal to found substitutionIds length, throw error
      if (substitutionIds.length !== item.substitution_material_id.length) {
        c.addError(
          item?.row_number.toString(),
          "validator.invalid_material_substitution_material_substitution_not_found",
          this.#getColumnTranslations(c).SubstitutionId
        )
      }
    }

    if (c.var.errors) {
      throw new ValidationError()
    }
    return rows
  }
}
