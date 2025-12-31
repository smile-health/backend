import { ValidationError } from "@smile/lib/error.js"
import { Context } from "hono"
import { AnnualNeedRepository } from "./annual-needs.repository.js"
import { CreateAnnualNeedsRequest } from "./annual-needs.schema.js"

export class AnnualNeedMiddleware {
  constructor(private readonly repository: AnnualNeedRepository) {}

  submit = async (c: Context, body: CreateAnnualNeedsRequest) => {
    const { entity_id, province_id, regency_id, program_plan_id } = body
    const result = await this.repository.findOne(c, {
      province_id,
      regency_id,
      entity_id,
      program_plan_id,
    })
    if (result) {
      throw new ValidationError(
        c.var.t("validator.invalid_submit_annual_needs_already_exist")
      )
    }

    return body
  }
}
