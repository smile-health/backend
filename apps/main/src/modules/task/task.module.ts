import { UserRepository } from "@/modules/user/user.repository.js"
import { NotFoundError } from "@smile/lib/error.js"
import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { generateEventCode } from "@smile/lib/utils.js"
import { Context } from "hono"
import { LocationRepository } from "../location/location.repository.js"
import { toDetailResponse, toListResponse } from "./task.mapper.js"
import { TaskRepository } from "./task.repository.js"
import {
  CoverageQueries,
  CreateInput,
  ListQueries,
  TaskItem,
  UpdateInput,
} from "./task.schema.js"

const EVENT_CODE_CONFIG = {
  length: 10,
  includeUppercase: true,
  includeLowercase: false,
  includeNumbers: true,
} as const

export class TaskModule {
  constructor(
    private readonly repository: TaskRepository,
    private readonly userRepo: UserRepository,
    private readonly locationRepo: LocationRepository
  ) {}

  private async findOrFail(c: Context, id: number) {
    const item = await this.repository.findById(c, id)
    if (!item) {
      throw new NotFoundError(c.var.t("validator.not_exist", { field: "task" }))
    }
    return item
  }

  async create(c: Context, body: CreateInput) {
    const items: Array<TaskItem & { code: string }> = []

    for (const group of body.target_groups) {
      const code = await generateEventCode(EVENT_CODE_CONFIG)

      items.push({
        program_plan_id: body.program_plan_id,
        material_id: body.material_id,
        activity_id: body.activity_id,
        ip: group.ip,
        month_distribution: body.month_distribution,
        target_group_id: group.target_group_id,
        number_of_dose: group.number_of_dose,
        coverages: group.coverages,
        code,
      })
    }

    await this.repository.createTasksWithCoverages(c, items)
  }

  async update(c: Context, id: number, body: UpdateInput) {
    await this.findOrFail(c, id)
    const group = body.target_groups[0]!

    await this.repository.updateTaskWithCoverages(c, id, {
      ip: group.ip,
      month_distribution: body.month_distribution,
      number_of_dose: group.number_of_dose,
      coverages: group.coverages,
    })
  }

  async list(c: Context, programPlanId: number, queries: ListQueries) {
    const [{ list, total }, totalProvince] = await Promise.all([
      this.repository.listByProgramPlan(c, programPlanId, queries),
      this.locationRepo.getTotalCountByLevel(c, 0),
    ])

    const userIds = Array.from(
      new Set(
        list
          .map((item) => item.updated_by)
          .filter((v): v is number => v != null)
      )
    )

    const userMap = await this.userRepo.getBasicDetailMapped(c, userIds)
    const data = list.map((item) =>
      toListResponse(item, userMap, totalProvince, c.var.language)
    )

    return new PaginatedResponse(queries, data, total)
  }

  async getCoverage(c: Context, taskId: number, queries: CoverageQueries) {
    const { list, total } = await this.repository.getCoverageList(
      c,
      taskId,
      queries
    )

    const data = list.map((item) => ({
      province_id: item.province_id,
      province_name: item.province_name,
      coverage_number: Number(item.coverage_number ?? 0),
    }))

    return new PaginatedResponse(queries, data, total)
  }

  async getById(c: Context, id: number) {
    const result = await this.findOrFail(c, id)
    return toDetailResponse(result)
  }

  async delete(c: Context, id: number) {
    await this.findOrFail(c, id)
    await this.repository.softDelete(c, id)
  }
}
