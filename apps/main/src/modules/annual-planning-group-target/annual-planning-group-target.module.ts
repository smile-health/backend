import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { Context } from "hono"
import { AnnualPlanningGroupTargetRepository } from "./annual-planning-group-target.repository.js"
import { GetListGroupTargetQueries } from "./annual-planning-group-target.schema.js"

export class AnnualPlanningGroupTargetModule {
  constructor(
    private readonly repository: AnnualPlanningGroupTargetRepository
  ) {}

  async listGroupTarget(c: Context, params: GetListGroupTargetQueries) {
    const result = await this.repository.getListTargetGroup(c, params)

    return new PaginatedResponse(params, result)
  }

  async list(c: Context, id: number, params: GetListGroupTargetQueries) {
    const { list, total } = await this.repository.getListPlanTargetGroup(
      c,
      id,
      params
    )
    const result = list.map((item) => {
      return {
        id: item.id,
        name: item.title,
        created_at: item.created_at,
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

    return new PaginatedResponse(params, result, total)
  }

  async submit(c: Context, id: number, params: number[]) {
    for (const value of params) {
      const payload = {
        target_group_id: value,
        program_plan_id: id,
      }

      await this.repository.create(c, payload)
    }

    return { message: "Success" }
  }

  async delete(c: Context, id: number, groupId: number) {
    const payload = {
      target_group_id: groupId,
      program_plan_id: id,
    }

    await this.repository.delete(c, payload)

    return { message: "Success" }
  }
}
