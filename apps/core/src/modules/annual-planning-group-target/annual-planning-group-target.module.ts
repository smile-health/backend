import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { Context } from "hono"
import { AnnualPlanningGroupTargetRepository } from "./annual-planning-group-target.repository.js"
import {
  GetListGroupTargetQueries,
  ImportTargetGroupRequest,
  RowType,
  SubmitGroupTargetRequest,
  UpdateGroupTargetRequest,
} from "./annual-planning-group-target.schema.js"
import { AnnualPlanningGroupTargetExcel } from "./annual-planning-group-target.excel.js"

export class AnnualPlanningGroupTargetModule {
  constructor(
    private readonly repository: AnnualPlanningGroupTargetRepository
  ) {}

  readonly #convertAge = (year: number, month: number, day: number) => {
    return year * 365 + month * 30 + day
  }

  readonly #convertDate = (totalDays: number) => {
    const years = Math.floor(totalDays / 365)
    const remainingAfterYears = totalDays % 365
    const months = Math.floor(remainingAfterYears / 30)
    const days = remainingAfterYears % 30

    return { years, months, days }
  }

  async list(c: Context, params: GetListGroupTargetQueries) {
    const { list, total } = await this.repository.getListGroupTarget(c, params)
    const result = list.map((item) => {
      const fromAge = this.#convertDate(item.age_min)
      const toAge = this.#convertDate(item.age_max)

      return {
        id: item.id,
        title: item.title,
        is_active: item.is_active,
        from_age: {
          year: fromAge.years,
          month: fromAge.months,
          day: fromAge.days,
        },
        to_age: {
          year: toAge.years,
          month: toAge.months,
          day: toAge.days,
        },
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

  async submit(c: Context, params: SubmitGroupTargetRequest) {
    const {
      title,
      from_year,
      from_month,
      from_day,
      to_year,
      to_month,
      to_day,
    } = params

    const ageMin = this.#convertAge(from_year, from_month, from_day)
    const ageMax = this.#convertAge(to_year, to_month, to_day)

    await this.repository.create(c, {
      title,
      updated_by: c.var.accountID,
      age_min: ageMin,
      age_max: ageMax,
    })

    return { message: "Success" }
  }

  async update(c: Context, id: number, params: UpdateGroupTargetRequest) {
    const {
      title,
      is_active,
      from_year,
      from_month,
      from_day,
      to_year,
      to_month,
      to_day,
    } = params
    const payload = {}
    if (title !== undefined) {
      const ageMin = this.#convertAge(from_year!, from_month!, from_day!)
      const ageMax = this.#convertAge(to_year!, to_month!, to_day!)
      payload["title"] = title
      payload["age_min"] = ageMin
      payload["age_max"] = ageMax
    } else if (is_active !== undefined) payload["is_active"] = is_active

    if (Object.keys(payload).length > 0) {
      await this.repository.update(c, payload, { id })
    }

    return { message: "Success" }
  }

  async export(c: Context, params: GetListGroupTargetQueries) {
    const stream = await this.repository.getListGroupTargetStream(c, params)

    // Create Excel File
    const excelTemplate = new AnnualPlanningGroupTargetExcel()
    await excelTemplate.loadFile(
      c,
      `annual_planning_group_target_${c.var.language}.xlsx`
    )
    excelTemplate.setTitle(
      `${c.var.t("annual_planning_group_target.label.title_file")}`
    )
    excelTemplate.setTimezone(c.req.header("Timezone"))

    // Create Excel File
    let count = 1
    const rows: RowType[][] = []
    for await (const item of stream) {
      const fromAge = this.#convertDate(item.age_min)
      const toAge = this.#convertDate(item.age_max)

      const row = [
        count,
        item.title,
        item.is_active === 1 ? c.var.t("common.yes") : c.var.t("common.no"),
        c.var.t("annual_planning_group_target.label.age", {
          from_year: fromAge.years,
          from_month: fromAge.months,
          from_day: fromAge.days,
          to_year: toAge.years,
          to_month: toAge.months,
          to_day: toAge.days,
        }),
      ]

      rows.push(row)
      count++
    }

    await excelTemplate.addRows(
      c.var.t("annual_planning_group_target.label.group_target"),
      rows,
      2,
      "A",
      {
        border: true,
      }
    )

    return excelTemplate.generate()
  }

  async import(c: Context, rows: ImportTargetGroupRequest) {
    for (const row of rows) {
      const ageMin = this.#convertAge(
        row.from_year,
        row.from_month,
        row.from_day
      )
      const ageMax = this.#convertAge(row.to_year, row.to_month, row.to_day)

      await this.repository.create(c, {
        title: row.name,
        updated_by: c.var.accountID,
        age_min: ageMin,
        age_max: ageMax,
      })
    }

    return { message: "Success" }
  }

  async template(c: Context) {
    const excelTemplate = new AnnualPlanningGroupTargetExcel()
    await excelTemplate.loadFile(
      c,
      `annual_planning_group_target_template_${c.var.language}.xlsx`
    )
    excelTemplate.setTitle(
      `${c.var.t("annual_planning_group_target.label.title_file")} Template`
    )
    excelTemplate.setTimezone(c.req.header("Timezone"))

    return excelTemplate.generate()
  }
}
