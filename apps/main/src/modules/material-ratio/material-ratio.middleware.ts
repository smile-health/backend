import { ValidationError } from "@smile-health/lib/error.js"
import { formatErrors } from "@smile-health/lib/zod.js"
import { Context } from "hono"
import z from "zod"
import {
  CreateInput,
  UpdateInput,
  createSchema,
  updateSchema,
} from "./material-ratio.schema.js"
import { MaterialRatioValidator } from "./material-ratio.validator.js"

export class MaterialRatioMiddleware {
  constructor(private readonly validator: MaterialRatioValidator) {}

  private throwValidationError(c: Context, error: z.ZodError) {
    c.set("errors", formatErrors(error, c.var.t, "material_ratio"))
    throw new ValidationError()
  }

  /**
   * Uses z.preprocess to collect ALL validation errors (schema + business rules)
   * before throwing, so FE receives complete error list in one response.
   */
  create = (c: Context) => {
    return z.preprocess(async (input) => {
      const parsed = createSchema.safeParse(input)
      const issues: z.ZodIssue[] = parsed.success
        ? []
        : [...parsed.error.issues]

      const item = (parsed.data ?? input) as CreateInput
      const [programPlanIssue, relationIssues] = await Promise.all([
        this.validator.validateProgramPlan(c, item.program_plan_id),
        this.validator.validateRelations(c, item),
      ])

      if (programPlanIssue) issues.push(programPlanIssue)
      issues.push(...relationIssues)

      if (issues.length > 0) {
        return this.throwValidationError(c, new z.ZodError(issues))
      }

      return parsed.data
    }, createSchema)
  }

  update = (c: Context) => {
    return z.preprocess(async (input) => {
      const parsed = updateSchema.safeParse(input)
      const issues: z.ZodIssue[] = parsed.success
        ? []
        : [...parsed.error.issues]

      const item = (parsed.data ?? input) as UpdateInput
      const relationIssues = await this.validator.validateRelations(c, item)
      issues.push(...relationIssues)

      if (issues.length > 0) {
        return this.throwValidationError(c, new z.ZodError(issues))
      }

      return parsed.data
    }, updateSchema)
  }
}
