import { PaginatedResponse } from "@smile-health/lib/types/paginate.js"
import { Context } from "hono"
import { AnnualPlanningProgramPlanRepository } from "./annual-planning-program-plan.repository.js"
import {
  GetListProgramPlanQueries,
  SubmitProgramPlanRequest,
} from "./annual-planning-program-plan.schema.js"
import { ValidationError } from "@smile-health/lib/error.js"

export class AnnualPlanningProgramPlanModule {
  constructor(
    private readonly repository: AnnualPlanningProgramPlanRepository
  ) {}

  async list(c: Context, params: GetListProgramPlanQueries) {
    const { programId } = c.var
    const { is_final } = params
    const { list, total } = await this.repository.getListProgramPlan(
      c,
      params,
      programId
    )
    const result = list
      .map((item) => {
        return {
          id: item.id,
          year: item.year,
          approach: {
            id: item.approach_id,
            name: item.approach_name,
          },
          program_id: item.program_id,
          is_final: item.status === 1,
          updated_at: item.updated_at,
          user_created_by: item.id_created
            ? {
                id: item.id_created,
                username: item.username_created,
                firstname: item.firstname_created,
                lastname: item.lastname_created,
              }
            : null,
          user_updated_by: item.id_updated
            ? {
                id: item.id_updated,
                username: item.username_updated,
                firstname: item.firstname_updated,
                lastname: item.lastname_updated,
              }
            : null,
        }
      })
      .filter((item) => is_final === undefined || item.is_final === is_final)

    return new PaginatedResponse(params, result, total)
  }

  async detail(c: Context, id: number) {
    const { programId } = c.var
    const detail = await this.repository.getDetailProgramPlan(c, id, programId)
    if (!detail) {
      throw new ValidationError(c.var.t("validator.program_plan_not_found"))
    }

    return {
      id: detail.id,
      year: detail.year,
      approach: {
        id: detail.approach_id,
        name: detail.approach_name,
      },
      status: {
        target_group: !!detail.id_target_group,
        population: !!detail.id_target_group,
        needs_calculation: !!detail.id_tasks,
        material_ratio: !!detail.id_material_ratio,
        material_substitution: !!detail.id_material_substitution,
      },
      program_id: detail.program_id,
      is_final: detail.status === 1,
    }
  }

  async submit(c: Context, params: SubmitProgramPlanRequest) {
    const { year, approach_id } = params
    const payload = {
      year,
      approach_id,
      status: 0,
    }

    await this.repository.create(c, payload)

    return { message: "Success" }
  }

  async status(c: Context, id: number) {
    const { programId } = c.var
    const detail = await this.repository.getDetailProgramPlan(c, id, programId)
    if (!detail) {
      throw new ValidationError(c.var.t("validator.program_plan_not_found"))
    }

    return {
      id,
      target_group_complete: !!detail.id_target_group,
      population_complete: !!detail.id_target_group,
      task_complete: !!detail.id_tasks,
      ratio_complete: !!detail.id_material_ratio,
      substitution_complete: !!detail.id_material_substitution,
    }
  }

  async submitStatus(c: Context, id: number) {
    const result = await this.repository.findOne(c, {
      id,
    })

    if (!result) {
      throw new ValidationError(c.var.t("validator.program_plan_not_found"))
    }

    await this.repository.update(c, { status: 1 }, { id })
    return { message: "Success" }
  }
}
