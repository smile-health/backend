import { NotFoundError } from "@smile-health/lib/error.js"
import BaseTemplate from "@smile-health/lib/excel/index.js"
import { PROCESSOR } from "@smile-health/lib/excel/types.js"
import { PaginatedResponse } from "@smile-health/lib/types/paginate.js"
import { flattenToNestedObject } from "@smile-health/lib/utils.js"
import { Context } from "hono"
import moment from "moment"
import { ActivityRepository } from "../activity/activity.repository.js"
import { ProgramPublisher } from "./program.publisher.js"
import { ProgramRepository } from "./program.repository.js"
import { ProgramParams, ProgramRequest } from "./program.schema.js"

export class ProgramModule {
  constructor(
    private readonly repository: ProgramRepository,
    private readonly activityRepo: ActivityRepository,
    private readonly publisher: ProgramPublisher
  ) {}

  async create(c: Context, body: ProgramRequest) {
    const values = {
      key: body.key,
      name: body.name,
      description: body.description,
      config: JSON.stringify(body.config),
      program_uuid: crypto.randomUUID(),
      updated_by: c.var.accountID,
    }

    const { protocol_ids } = body

    const program = await this.repository.create(c, values)
    await this.publisher.processCreate(c, Number(program.insertId))

    if (protocol_ids && protocol_ids.length > 0) {
      await this.repository.updateProtocolByProgramId(
        c,
        Number(program.insertId),
        protocol_ids
      )
    }

    const data = await this.repository.findOne(c, { key: body.key })
    return data ? this.detail(c, data.id) : null
  }

  async list(c: Context, params: ProgramParams) {
    const { total, data } = await this.repository.findAll(c, params)
    return new PaginatedResponse(
      params,
      flattenToNestedObject(data),
      Number(total ?? 0)
    )
  }

  async detail(c: Context, id: number) {
    const data = await this.repository.findDetail(c, id)
    if (!data) {
      throw new NotFoundError(
        `${c.var.t("validator.not_exist", { field: "program" })}`
      )
    }
    return flattenToNestedObject([data])[0]
  }

  async update(c: Context, body: ProgramRequest, id: number) {
    const values = {
      name: body.name,
      description: body.description,
      config: body.config,
    }
    await this.repository.updateWithConfig(c, values, { id })
    const { protocol_ids } = body
    if (protocol_ids && protocol_ids.length > 0) {
      await this.repository.updateProtocolByProgramId(c, id, protocol_ids)
    }
    return this.detail(c, id)
  }

  readonly #formatDate = (date?: unknown) =>
    typeof date === "string" || typeof date === "number" || date instanceof Date
      ? moment(date).local().format("YYYY-MM-DD HH:mm")
      : ""

  readonly #getFullName = (user: unknown): string => {
    if (
      typeof user === "object" &&
      user !== null &&
      "firstname" in user &&
      "lastname" in user
    ) {
      const { firstname, lastname } = user as {
        firstname?: string
        lastname?: string
      }
      return `${firstname ?? ""} ${lastname ?? ""}`.trim()
    }
    return ""
  }

  async export(c: Context, query: ProgramParams) {
    const t = c.var.t
    const [yes, no, active, inactive] = [
      t("common.yes"),
      t("common.no"),
      t("common.active"),
      t("common.inactive"),
    ]

    const excelTemplate = new BaseTemplate(PROCESSOR.SHEETJS)
    excelTemplate.setTitle(t("program.label.title"))
    excelTemplate.setTimezone(c.req.header("Timezone"))

    // Utility: set column headers
    const setSheetColumns = (
      sheetName: string,
      headers: { header: string; width: number }[]
    ) => excelTemplate.setColumns(headers, "A1", sheetName)

    // Sheet: Program
    const sheetProgram = t("common.program")
    await excelTemplate.initSheet(sheetProgram)
    setSheetColumns(sheetProgram, [
      { header: t("program.label.program_name"), width: 30 },
      { header: t("common.description"), width: 20 },
      { header: t("program.label.material_classification"), width: 20 },
      { header: t("common.updated_at"), width: 30 },
      { header: t("common.updated_by"), width: 30 },
    ])

    const programs = await this.repository.findAllWithoutPagination(c, query)
    const mappedPrograms = programs.map((item) => {
      const config =
        typeof item.config === "object" && item.config !== null
          ? (item.config as { material?: { is_hierarchy_enabled?: boolean } })
          : {}
      return {
        name: item.name,
        description: item.description,
        config: config?.material?.is_hierarchy_enabled ? yes : no,
        updated_at: this.#formatDate(item.updated_at),
        updated_by: this.#getFullName(item.user_updated_by),
      }
    })
    await excelTemplate.addRows(sheetProgram, mappedPrograms)

    // Sheet: Activity
    const sheetActivity = t("common.activity")
    await excelTemplate.initSheet(sheetActivity)
    setSheetColumns(sheetActivity, [
      { header: t("program.label.program_name"), width: 30 },
      { header: t("activity.label.name"), width: 30 },
      { header: t("activity.label.is_ordered_sales"), width: 20 },
      { header: t("activity.label.is_ordered_purchase"), width: 20 },
      { header: t("activity.label.protocol"), width: 20 },
      { header: t("common.status"), width: 20 },
      { header: t("activity.label.created_at"), width: 30 },
      { header: t("activity.label.updated_at"), width: 30 },
      { header: t("activity.label.created_by"), width: 30 },
      { header: t("activity.label.updated_by"), width: 30 },
    ])

    const bulkActivities = await Promise.all(
      programs.map((itemProgram) => {
        if (typeof itemProgram.id === "number") {
          return this.activityRepo.findAllWithoutPaginate(c, itemProgram.id)
        }
        return Promise.resolve([])
      })
    )
    const activities = bulkActivities.flatMap((activities) => activities)
    const mappedActivities = activities.map((item) => ({
      program_name: item.program_name,
      name: item.name,
      is_ordered_sales: item.is_ordered_sales === 1 ? yes : no,
      is_ordered_purchase: item.is_ordered_purchase === 1 ? yes : no,
      protocol: item.protocol,
      status: item.status ? active : inactive,
      created_at: this.#formatDate(item.created_at),
      updated_at: this.#formatDate(item.updated_at),
      created_by: this.#getFullName(item.user_created_by),
      updated_by: this.#getFullName(item.user_updated_by),
    }))
    await excelTemplate.addRows(sheetActivity, mappedActivities)

    return await excelTemplate.generate()
  }
}
