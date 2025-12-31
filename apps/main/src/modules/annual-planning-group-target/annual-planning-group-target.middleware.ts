import { ValidationError } from "@smile/lib/error.js"
import { Context } from "hono"
import { AnnualPlanningGroupTargetRepository } from "./annual-planning-group-target.repository.js"

export class AnnualPlanningGroupTargetMiddleware {
  constructor(
    private readonly repository: AnnualPlanningGroupTargetRepository
  ) {}

  submitProgramPlanGroupTarget = async (c: Context, body: number[]) => {
    const id = c.req.param("id")
    const [listIDTargetGroup, listPlanTargetGroup] = await Promise.all([
      this.repository.validateListTargetGroup(c, body),
      this.repository.find(c, {
        program_plan_id: id,
        target_group_id: body,
      }),
    ])

    body.forEach((value, idx) => {
      const idTargetGroup = listIDTargetGroup.find((item) => {
        return item.id === value
      })

      const idProgramTargetGroup = listPlanTargetGroup.find((item) => {
        return item.target_group_id === value
      })

      if (!idTargetGroup) {
        c.addError(`${idx}`, "validator.invalid_id_program_plan_target_group")
      }

      if (idProgramTargetGroup) {
        c.addError(
          `${idx}`,
          "validator.id_program_plan_target_group_already_exist"
        )
      }
    })

    if (c.var.errors) {
      throw new ValidationError()
    }

    return body
  }

  deleteProgramPlanGroupTarget = async (c: Context, param) => {
    const { id, group_id } = param
    const idTargetGroup = await this.repository.findOne(c, {
      program_plan_id: id,
      target_group_id: group_id,
    })

    if (!idTargetGroup) {
      throw new ValidationError(
        c.var.t("validator.invalid_id_program_plan_target_group")
      )
    }

    return param
  }
}
