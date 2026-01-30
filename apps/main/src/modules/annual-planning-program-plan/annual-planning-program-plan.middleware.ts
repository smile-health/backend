import { ValidationError } from "@smile-health/lib/error.js"
import { Context } from "hono"
import { AnnualPlanningProgramPlanRepository } from "./annual-planning-program-plan.repository.js"
import { SubmitProgramPlanRequest } from "./annual-planning-program-plan.schema.js"

export class AnnualPlanningProgramPlanMiddleware {
  constructor(
    private readonly repository: AnnualPlanningProgramPlanRepository
  ) {}

  submit = async (c: Context, body: SubmitProgramPlanRequest) => {
    const { year, approach_id } = body
    const { programId } = c.var
    const result = await this.repository.findOne(c, {
      year,
      approach_id,
      program_id: programId,
    })
    if (result) {
      throw new ValidationError(
        c.var.t("validator.invalid_submit_program_plan_already_exist")
      )
    }

    return body
  }
}
