import { UserRepository } from "@/modules/user/user.repository.js"
import { NotFoundError } from "@smile/lib/error.js"
import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { Context } from "hono"
import { toResponse } from "./material-ratio.mapper.js"
import { MaterialRatioRepository } from "./material-ratio.repository.js"
import {
  CreateInput,
  ListQueries,
  UpdateInput,
} from "./material-ratio.schema.js"

export class MaterialRatioModule {
  constructor(
    private readonly repository: MaterialRatioRepository,
    private readonly userRepo: UserRepository
  ) {}

  private async findOrFail(c: Context, id: number) {
    const item = await this.repository.findById(c, id)
    if (!item) {
      throw new NotFoundError(
        c.var.t("validator.not_exist", { field: "material_ratio" })
      )
    }
    return item
  }

  async create(c: Context, body: CreateInput) {
    await this.repository.insert(c, body)
  }

  async update(c: Context, id: number, body: UpdateInput) {
    await this.findOrFail(c, id)
    await this.repository.patch(c, id, body)
  }

  async list(c: Context, programPlanId: number, queries: ListQueries) {
    const { list, total } = await this.repository.listByProgramPlan(
      c,
      programPlanId,
      queries
    )

    const userIds = Array.from(
      new Set(
        list
          .map((item) => item.updated_by)
          .filter((v): v is number => v != null)
      )
    )

    const userMap = await this.userRepo.getBasicDetailMapped(c, userIds)
    const data = list.map((item) => toResponse(item, userMap))

    return new PaginatedResponse(queries, data, total)
  }

  async getById(c: Context, id: number) {
    const item = await this.findOrFail(c, id)
    const userIds = item.updated_by ? [item.updated_by] : []
    const userMap = await this.userRepo.getBasicDetailMapped(c, userIds)

    return toResponse(item, userMap)
  }

  async delete(c: Context, id: number) {
    await this.findOrFail(c, id)
    await this.repository.softDelete(c, id)
  }
}
