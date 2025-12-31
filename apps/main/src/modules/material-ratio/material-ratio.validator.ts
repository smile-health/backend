import { Context } from "hono"
import z from "zod"
import { AnnualPlanningProgramPlanRepository } from "../annual-planning-program-plan/annual-planning-program-plan.repository.js"
import { MaterialSubtypeRepository } from "../material-subtype/material-subtype.repository.js"
import { MaterialRepository } from "../material/material.repository.js"

const notExistIssue = (path: string): z.ZodIssue => ({
  code: z.ZodIssueCode.custom,
  path: [path],
  message: "validator.not_exist",
})

const notMatchIssue = (path: string): z.ZodIssue => ({
  code: z.ZodIssueCode.custom,
  path: [path],
  message: "validator.not_match",
})

function collectNotExistIssues(
  checks: { valid: boolean; exists: unknown; path: string }[]
) {
  return checks
    .filter((check) => check.valid && !check.exists)
    .map((check) => notExistIssue(check.path))
}

export class MaterialRatioValidator {
  constructor(
    private readonly programPlanRepo: AnnualPlanningProgramPlanRepository,
    private readonly materialRepo: MaterialRepository,
    private readonly materialSubtypeRepo: MaterialSubtypeRepository
  ) {}

  async validateProgramPlan(c: Context, programPlanId: unknown) {
    // Skip business validation when schema has already rejected the field type
    if (typeof programPlanId !== "number") return null

    const programPlan = await this.programPlanRepo.findOne(c, {
      id: programPlanId,
    })

    return programPlan ? null : notExistIssue("program_plan_id")
  }

  async validateRelations(
    c: Context,
    input: {
      from_subtype_id: unknown
      from_material_id: unknown
      to_subtype_id: unknown
      to_material_id: unknown
    }
  ) {
    const { from_subtype_id, to_subtype_id, from_material_id, to_material_id } =
      input

    // Only run DB checks for fields that passed basic type validation
    const validFromSubtype = typeof from_subtype_id === "number"
    const validToSubtype = typeof to_subtype_id === "number"
    const validFromMaterial = typeof from_material_id === "number"
    const validToMaterial = typeof to_material_id === "number"
    const canCheckRelation = validFromSubtype && validToSubtype

    const [fromSubtype, toSubtype, fromMaterial, toMaterial, relation] =
      await Promise.all([
        validFromSubtype
          ? this.materialSubtypeRepo.findById(c, from_subtype_id)
          : null,
        validToSubtype
          ? this.materialSubtypeRepo.findById(c, to_subtype_id)
          : null,
        validFromMaterial
          ? this.materialRepo.findById(c, from_material_id)
          : null,
        validToMaterial ? this.materialRepo.findById(c, to_material_id) : null,
        canCheckRelation
          ? this.materialSubtypeRepo.findRelation(
              c,
              from_subtype_id,
              to_subtype_id
            )
          : null,
      ])

    const issues = collectNotExistIssues([
      { valid: validFromSubtype, exists: fromSubtype, path: "from_subtype_id" },
      { valid: validToSubtype, exists: toSubtype, path: "to_subtype_id" },
      {
        valid: validFromMaterial,
        exists: fromMaterial,
        path: "from_material_id",
      },
      { valid: validToMaterial, exists: toMaterial, path: "to_material_id" },
    ])

    if (canCheckRelation && !relation) {
      issues.push(notMatchIssue("to_subtype_id"))
    }

    return issues
  }
}
