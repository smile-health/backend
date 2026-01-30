import { PaginatedResponse } from "@smile-health/lib/types/paginate.js"
import { collect, merge, pick } from "@smile-health/lib/utils.js"
import { Context } from "hono"
import moment from "moment"
import { ActivityRepository } from "../activity/activity.repository.js"
import { UserRepository } from "../user/user.repository.js"
import {
  CreateActivityRequest,
  GetActivityQuery,
  UpdateActivityRequest,
} from "./activity.schema.js"
import { ActivityPublisher } from "./activity.publisher.js"
import { ActivityExcel } from "./activity.excel.js"

export class ActivityModule {
  constructor(
    private readonly activityRepo: ActivityRepository,
    private readonly userRepo: UserRepository,
    private readonly activityPublisher: ActivityPublisher
  ) {}

  #messageResponse(info: string) {
    return {
      success: true,
      message: `Data successfully ${info}`,
    }
  }

  readonly #detailResponse = async (c: Context, id: number) => {
    const detail = await this.detailResponse(c, Number(id))
    const message = this.#messageResponse("updated")
    const response = {
      ...message,
      result: detail,
    }

    return response
  }

  async list(c: Context, params: GetActivityQuery) {
    const programId = Number(c.req.param("program_id"))
    const { sort_by, sort_type } = params
    const { data, total } = await this.activityRepo.findAll(
      c,
      params,
      programId,
      sort_by,
      sort_type
    )
    if (data.length === 0) {
      return new PaginatedResponse(params)
    }

    const list = await this.listResponse(c, data)

    return new PaginatedResponse(params, list, total)
  }

  async detail(c: Context, id: number) {
    return this.detailResponse(c, id)
  }

  async create(c: Context, req: CreateActivityRequest) {
    const programId = Number(c.req.param("program_id"))
    const userId = c.var.accountID
    const result = await this.activityRepo.create(c, {
      ...req,
      program_id: programId,
      updated_by: userId,
      updated_at: new Date(),
    })

    await this.activityPublisher.processCreate(c, {
      ...req,
      id: Number(result.insertId),
      program_id: programId,
    })

    const detail = await this.detailResponse(c, Number(result.insertId))
    const message = this.#messageResponse("created")
    const response = {
      ...message,
      result: detail,
    }

    return response
  }

  async update(c: Context, id: number, req: UpdateActivityRequest) {
    const userId = c.var.accountID
    delete req.status
    delete req.protocol
    await this.activityRepo.update(
      c,
      {
        ...req,
        updated_at: new Date(),
        updated_by: userId,
      },
      { id }
    )

    await this.activityPublisher.processUpdate(c, {
      ...req,
      id: Number(id),
      program_id: c.get("programId"),
    })

    return this.#detailResponse(c, id)
  }

  async status(c: Context, id: number, status: boolean) {
    const userId = c.var.accountID
    await this.activityRepo.update(
      c,
      {
        status,
        updated_at: new Date(),
        updated_by: userId,
      },
      { id }
    )

    return this.#detailResponse(c, id)
  }

  async export(c: Context, query: GetActivityQuery) {
    const t = c.var.t
    const programId = Number(c.req.param("program_id"))
    const title = t("activity.export.title")
    const excelTemplate = new ActivityExcel(1, 0)
    excelTemplate.setTitle(title)
    excelTemplate.setTimezone(c.req.header("Timezone"))
    await excelTemplate.initSheet(title)

    excelTemplate.setColumns([
      {
        header: t("activity.label.name"),
        width: 30,
      },
      {
        header: t("activity.label.is_ordered_sales"),
        width: 20,
      },
      {
        header: t("activity.label.is_ordered_purchase"),
        width: 20,
      },
      {
        header: t("activity.label.protocol"),
        width: 20,
      },
      {
        header: t("common.status"),
        width: 20,
      },
      {
        header: t("activity.label.created_at"),
        width: 30,
      },
      {
        header: t("activity.label.updated_at"),
        width: 30,
      },
      {
        header: t("activity.label.created_by"),
        width: 30,
      },
      {
        header: t("activity.label.updated_by"),
        width: 30,
      },
    ])

    const data = await this.activityRepo.findAllForExport(c, query, programId)
    if (data.length === 0) return await excelTemplate.generate()

    const items = await this.listResponse(c, data)

    await excelTemplate.addRows(
      title,
      items.map((item) => ({
        name: item.name,
        is_ordered_sales:
          item.is_ordered_sales === 1
            ? c.var.t("common.yes")
            : c.var.t("common.no"),
        is_ordered_purchase:
          item.is_ordered_purchase === 1
            ? c.var.t("common.yes")
            : c.var.t("common.no"),
        protocol: item.protocol,
        status: item.status
          ? c.var.t("common.active")
          : c.var.t("common.inactive"),
        created_at: moment(item.created_at).local().format("YYYY-MM-DD HH:mm"),
        updated_at: moment(item.updated_at).local().format("YYYY-MM-DD HH:mm"),
        created_by: item?.user_created_by
          ? `${item.user_created_by.firstname || ""} ${item.user_created_by.lastname || ""}`.trim()
          : "",
        updated_by: item?.user_updated_by
          ? `${item.user_updated_by.firstname || ""} ${item.user_updated_by.lastname || ""}`.trim()
          : "",
      }))
    )

    return await excelTemplate.generate()
  }

  async template(c: Context) {
    const excelTemplate = new ActivityExcel()
    const title = c.var.t("activity.export.title_template")
    excelTemplate.setTitle(title)
    excelTemplate.setTimezone(c.req.header("Timezone"))

    await excelTemplate.loadFile(c.var.t("activity.export.file_template"))

    return await excelTemplate.generate()
  }

  async import(c: Context, rows: CreateActivityRequest[]) {
    const programId = Number(c.req.param("program_id"))
    const userId = c.var.accountID
    for (const row of rows) {
      const newRow = {
        name: row.name,
        is_ordered_sales: row.is_ordered_sales,
        is_ordered_purchase: row.is_ordered_purchase,
        protocol: row.protocol,
        program_id: programId,
        created_by: userId,
        updated_by: userId,
      }
      await this.activityRepo.create(c, newRow)
    }
    const response = this.#messageResponse(
      `created, total ${rows.length} rows have been created`
    )
    return response
  }

  async detailResponse(c: Context, id: number) {
    const programId = Number(c.req.param("program_id"))
    const data = await this.activityRepo.findById(c, id, programId)
    if (data) {
      const mapUsers = await this.userRepo.getBasicDetailMapped(c, [
        Number(data?.created_by),
        Number(data?.updated_by),
      ])

      return {
        ...pick(data!, [
          "id",
          "name",
          "protocol",
          "status",
          "is_ordered_purchase",
          "is_ordered_sales",
          "created_at",
          "updated_at",
        ]),
        user_created_by: mapUsers[data!.created_by ?? 0] ?? null,
        user_updated_by: mapUsers[data!.updated_by ?? 0] ?? null,
      }
    }
    return {}
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async listResponse<T extends Record<string, any>>(c: Context, data: T[]) {
    const createdUsers = collect(data, "created_by")
    const updatedUsers = collect(data, "updated_by")
    const mapUsers = await this.userRepo.getBasicDetailMapped(
      c,
      merge(createdUsers, updatedUsers)
    )

    const list = data.map((res) => ({
      ...pick(res, [
        "id",
        "name",
        "protocol",
        "status",
        "is_ordered_purchase",
        "is_ordered_sales",
        "created_at",
        "updated_at",
      ]),
      user_created_by: mapUsers[res.created_by ?? 0] ?? null,
      user_updated_by: mapUsers[res.updated_by ?? 0] ?? null,
    }))

    return list
  }
}
