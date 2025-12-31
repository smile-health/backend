import { NotFoundError, ValidationError } from "@smile/lib/error.js"
import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { collect } from "@smile/lib/utils.js"
import { Context } from "hono"
import { UserRepository } from "../user/user.repository.js"
import { ManufacturePublisher } from "./manufacture.publisher.js"
import { ManufactureRepository } from "./manufacture.repository.js"
import {
  ManufactureDetailRequestDTO,
  ManufacturePaginatedRequestDTO,
  UpdateStatusRequest,
} from "./manufacture.schema.js"

export class ManufactureModule {
  constructor(
    private readonly repo: ManufactureRepository,
    private readonly userRepo: UserRepository,
    private readonly publisher: ManufacturePublisher
  ) {}

  async list(c: Context, params: ManufacturePaginatedRequestDTO) {
    params.isPaginate = true
    params.offset = (params.page - 1) * params.paginate

    const { data, total } = await this.repo.findAll(c, params)
    if (!data.length) return new PaginatedResponse(params)

    const typeIds = collect(data, "type")
    const userIds = collect(data, "updated_by")

    const [types, users] = await Promise.all([
      this.repo.findAndGroupByTypeID(c, typeIds),
      userIds.length ? this.userRepo.getBasicDetailMapped(c, userIds) : {},
    ])

    const manufactures = data.map((el) => ({
      ...el,
      manufacture_type: el.type
        ? {
            ...(types[el.type] as { id: number; name: string }),
            name: c.var.t(`manufacture.type.${el.type}`),
          }
        : {},
      user_updated_by: users[el.updated_by ?? 0] ?? {},
    }))

    return new PaginatedResponse(params, manufactures, total)
  }

  async detail(c: Context, id: ManufactureDetailRequestDTO) {
    const manufacture = await this.repo.findOne(c, id)
    if (!manufacture)
      throw new NotFoundError(
        c.var.t("validator.not_exist", { field: "manufacture" })
      )
    if (manufacture.deleted_at)
      throw new ValidationError(
        c.var.t("validator.delete", { field: "manufacture" })
      )

    const [type] = await Promise.all([
      this.repo.findByTypeID(c, manufacture.type),
    ])

    return {
      ...manufacture,
      manufacture_type: type
        ? {
            ...type,
            name: c.var.t(`manufacture.type.${type.id}`),
          }
        : undefined,
    }
  }

  async updateStatus(c: Context, id: number, req: UpdateStatusRequest) {
    const manufacture = await this.repo.findOne(c, { id })
    if (!manufacture) {
      throw new NotFoundError(
        c.var.t("validator.not_exist", { field: "manufacture" })
      )
    }

    await this.repo.updateStatus(c, id, req.status)
    await this.publisher.processUpdateStatus(c, {
      id: id,
      program_id: c.var.programId,
      status: req.status,
    })
  }
}
