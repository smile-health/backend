import { PaginatedResponse } from "@smile-health/lib/types/paginate.js"
import { collect, merge, pick } from "@smile-health/lib/utils.js"
import { Context } from "hono"
import moment from "moment"
import { ActivityRepository } from "../activity/activity.repository.js"
import { UserRepository } from "../user/user.repository.js"
import { ActivityTemplate, ActivityExport } from "./activity.excel.js"
import {
  CreateActivityRequest,
  GetActivityQuery,
  UpdateActivityRequest,
} from "./activity.schema.js"
import { ActivityPublisher } from "./activity.publisher.js"

export class ActivityModule {
  constructor(
    private readonly activityRepo: ActivityRepository,
    private readonly userRepo: UserRepository,
    private readonly activityPublisher: ActivityPublisher
  ) {}

  #getUserGlobalId(c: Context) {
    const user = c.var.user as { global_id?: number }
    return Number(user?.global_id ?? 0)
  }

  async list(c: Context, params: GetActivityQuery) {
    const { sort_by, sort_type } = params
    const { data, total } = await this.activityRepo.findAll(
      c,
      params,
      c.get("programId"),
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
    const response = await this.detailResponse(c, id)

    return response
  }

  async create(c: Context, req: CreateActivityRequest) {
    const userId = this.#getUserGlobalId(c)
    const result = await this.activityRepo.createActivity(c, {
      ...req,
      program_id: c.get("programId"),
      created_by: userId,
      updated_by: userId,
    })

    await this.activityPublisher.processCreate(c, {
      ...req,
      id: Number(result.insertId),
      program_id: c.get("programId"),
    })

    const detail = await this.detailResponse(c, Number(result.insertId))
    const message = this.#messageResponse("created")
    const response = {
      ...message,
      result: detail,
    }

    return response
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

  async update(c: Context, id: number, req: UpdateActivityRequest) {
    const userId = this.#getUserGlobalId(c)
    delete req.status
    delete req.protocol
    await this.activityRepo.updateActivity(c, id, {
      ...req,
      updated_at: new Date(),
      updated_by: userId,
    })

    await this.activityPublisher.processUpdate(c, {
      ...req,
      id: Number(id),
      program_id: c.get("programId"),
    })

    return this.#detailResponse(c, id)
  }

  async status(c: Context, id: number, status: boolean) {
    const userId = this.#getUserGlobalId(c)
    await this.activityRepo.updateActivity(c, id, {
      status,
      updated_at: new Date(),
      updated_by: userId,
    })

    return this.#detailResponse(c, id)
  }

  async export(c: Context, query: GetActivityQuery) {
    const language = c.var.language
    const title = this.#getTranslation(language, "Activity", "Aktivitas")
    const excelTemplate = new ActivityExport()
    excelTemplate.setTitle(title)
    excelTemplate.setTimezone(c.req.header("Timezone"))
    await excelTemplate.initSheet(title)

    excelTemplate.setColumns([
      {
        header: c.var.t("activity.label.name"),
        width: 30,
      },
      {
        header: c.var.t("activity.label.is_ordered_sales"),
        width: 20,
      },
      {
        header: c.var.t("activity.label.is_ordered_purchase"),
        width: 20,
      },
      {
        header: c.var.t("activity.label.protocol"),
        width: 20,
      },
      {
        header: c.var.t("common.status"),
        width: 20,
      },
      {
        header: c.var.t("activity.label.created_at"),
        width: 30,
      },
      {
        header: c.var.t("activity.label.updated_at"),
        width: 30,
      },
      {
        header: c.var.t("activity.label.created_by"),
        width: 30,
      },
      {
        header: c.var.t("activity.label.updated_by"),
        width: 30,
      },
    ])

    const { data } = await this.activityRepo.findAllWithoutPaginate(
      c,
      query,
      c.get("programId")
    )
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
    const language = c.var.language

    const excelTemplate = new ActivityTemplate()
    const title = this.#getTranslation(
      language,
      "Template Activity",
      "Template Aktivitas"
    )
    excelTemplate.setTitle(title)
    excelTemplate.setTimezone(c.req.header("Timezone"))

    await excelTemplate.loadFile(
      this.#getTranslation(language, "activity_en.xlsx", "activity_id.xlsx")
    )

    return await excelTemplate.generate()
  }

  async import(c: Context, rows: CreateActivityRequest[]) {
    const userId = this.#getUserGlobalId(c)
    for (const row of rows) {
      const newRow = {
        name: row.name,
        is_ordered_sales: row.is_ordered_sales,
        is_ordered_purchase: row.is_ordered_purchase,
        protocol: row.protocol,
        program_id: c.get("programId"),
        created_by: userId,
        updated_by: userId,
      }
      await this.activityRepo.createActivity(c, newRow)
    }
    const response = this.#messageResponse(
      `created, total ${rows.length} rows have been created`
    )
    return response
  }

  async detailResponse(c: Context, id: number) {
    const data = await this.activityRepo.findById(c, id, c.get("programId"))
    if (data) {
      const mapUsers = await this.userRepo.getBasicDetailMappedTableUser(c, [
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
    const mapUsers = await this.userRepo.getBasicDetailMappedTableUser(
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

  #messageResponse(info: string) {
    return {
      success: true,
      message: `Data successfully ${info}`,
    }
  }

  #getTranslation(language: string, en: string, id: string): string {
    const translation: string = language.toLowerCase() === "en" ? en : id
    return translation
  }
}
