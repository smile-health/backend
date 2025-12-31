import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { collect, merge, pick } from "@smile/lib/utils.js"
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

export class ActivityModule {
  constructor(
    private activityRepo: ActivityRepository,
    private userRepo: UserRepository
  ) {}

  async list(c: Context, params: GetActivityQuery) {
    const { data, total } = await this.activityRepo.findAll(c, params)
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
    const userId = Number(c.var.userId)
    const result = await this.activityRepo.createActivity(c, {
      ...req,
      created_by: userId,
      updated_by: userId,
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
    const userId = Number(c.var.userId)
    await this.activityRepo.updateActivity(c, id, {
      ...req,
      updated_by: userId,
    })
    const detail = await this.detailResponse(c, Number(id))
    const message = this.#messageResponse("updated")
    const response = {
      ...message,
      result: detail,
    }

    return response
  }

  async delete(c: Context, id: number) {
    const deleted_by: number = Number(c.var.userId)
    const deleted_at: Date = new Date()

    const req = {
      deleted_by: deleted_by,
      deleted_at: deleted_at,
    }
    await this.activityRepo.deleteActivity(c, id, req)

    const response = this.#messageResponse("deleted")

    return response
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
        key: "name",
        header: c.var.t("activity.label.name"),
        width: 30,
      },
      {
        key: "is_ordered_sales",
        header: c.var.t("activity.label.is_ordered_sales"),
        width: 20,
      },
      {
        key: "is_ordered_purchase",
        header: c.var.t("activity.label.is_ordered_purchase"),
        width: 20,
      },
      {
        key: "created_at",
        header: c.var.t("activity.label.created_at"),
        width: 30,
      },
      {
        key: "updated_at",
        header: c.var.t("activity.label.updated_at"),
        width: 30,
      },
      {
        key: "created_by",
        header: c.var.t("activity.label.created_by"),
        width: 30,
      },
      {
        key: "updated_by",
        header: c.var.t("activity.label.updated_by"),
        width: 30,
      },
    ])

    const { data } = await this.activityRepo.findAllWithoutPaginate(c, query)
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
        created_at: moment(item.created_at).local().format("YYYY-MM-DD HH:mm"),
        updated_at: moment(item.updated_at).local().format("YYYY-MM-DD HH:mm"),
        created_by: !item?.user_created_by?.fullname
          ? ""
          : item?.user_created_by?.fullname,
        updated_by: !item?.user_updated_by?.fullname
          ? ""
          : item?.user_updated_by?.fullname,
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
    for (const row of rows) {
      const newRow = {
        name: row.name,
        is_ordered_sales: row.is_ordered_sales,
        is_ordered_purchase: row.is_ordered_purchase,
        created_by: Number(c.var.userId),
        updated_by: Number(c.var.userId),
      }
      await this.activityRepo.create(c, newRow)
    }
    const response = this.#messageResponse(
      `created, total ${rows.length} rows have been created`
    )
    return response
  }

  async detailResponse(c: Context, id: number) {
    const data = await this.activityRepo.findById(c, id)
    if (data) {
      const mapUsers = await this.userRepo.getBasicDetailMapped(c, [
        Number(data?.created_by),
        Number(data?.updated_by),
      ])

      return {
        ...pick(data!, [
          "id",
          "name",
          "is_ordered_purchase",
          "is_ordered_sales",
          "created_at",
          "updated_at",
        ]),
        user_created_by: mapUsers[data!.created_by ?? 0],
        user_updated_by: mapUsers[data!.updated_by ?? 0],
      }
    }
    return {}
  }

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
        "is_ordered_purchase",
        "is_ordered_sales",
        "created_at",
        "updated_at",
      ]),
      user_created_by: mapUsers[res.created_by ?? 0],
      user_updated_by: mapUsers[res.updated_by ?? 0],
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
