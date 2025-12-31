import env from "@/config/env.js"
import { NotFoundError, ValidationError } from "@smile/lib/error.js"
import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { collect } from "@smile/lib/utils.js"
import { Context } from "hono"
import { UserRepository } from "../user/user.repository.js"
import { ManufactureRepository } from "./manufacture.repository.js"
import {
  ManufacturePaginatedRequestDTO,
  ManufactureSyncRequestDTO,
} from "./manufacture.schema.js"

export class ManufactureModule {
  constructor(
    private readonly repo: ManufactureRepository,
    private readonly userRepo: UserRepository
  ) {}

  async syncData(c: Context, request: ManufactureSyncRequestDTO) {
    if (request.workspace_ids?.includes(env.WORKSPACE_ID)) {
      const [manufacture] = await Promise.all([
        this.repo.findDynamic(c, "global_id", "=", request.id, true),
      ])

      request.global_id = request.id
      request.id = manufacture ? manufacture.id : 0
      delete request.workspace_ids

      await this.repo.upsert(c, request)
    }
  }

  async list(c: Context, params: ManufacturePaginatedRequestDTO) {
    params.isPaginate = true
    params.offset = (params.page - 1) * params.paginate

    const { data, total } = await this.repo.findAll(c, params)

    if (data.length === 0) {
      return new PaginatedResponse(params)
    }

    const typeIds = collect(data, "type")

    const [types] = await Promise.all([
      this.repo.findAndGroupByTypeID(c, typeIds),
    ])

    const manufactures = data.map((el) => ({
      ...el,
      manufacture_type: types[el.type ?? 0]?.[0] ?? {},
    }))

    return new PaginatedResponse(params, manufactures, total)
  }

  async detail(c: Context, id: number) {
    const manufacture = await this.repo.findDynamic(c, "id", "=", id, true)

    if (!manufacture) throw new NotFoundError("Manufacture not found.")
    if (manufacture.deleted_at)
      throw new ValidationError("Manufacture id has been deleted")

    const [type] = await Promise.all([
      this.repo.findByTypeID(c, manufacture.type),
    ])

    return {
      ...manufacture,
      manufacture_type: type,
    }
  }
}
