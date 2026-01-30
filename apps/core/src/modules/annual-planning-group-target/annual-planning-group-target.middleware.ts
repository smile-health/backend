import { ValidationError } from "@smile-health/lib/error.js"
import { Context } from "hono"
import { AnnualPlanningGroupTargetRepository } from "./annual-planning-group-target.repository.js"
import {
  ImportTargetGroupRequest,
  SubmitGroupTargetRequest,
  UpdateGroupTargetRequest,
} from "./annual-planning-group-target.schema.js"
import BaseTemplate from "@smile-health/lib/excel/index.js"

export class AnnualPlanningGroupTargetMiddleware {
  constructor(
    private readonly repository: AnnualPlanningGroupTargetRepository
  ) {}

  readonly #convertAge = (year: number, month: number, day: number) => {
    return year * 365 + month * 30 + day
  }

  submit = async (c: Context, body: SubmitGroupTargetRequest) => {
    const {
      title,
      from_year,
      from_month,
      from_day,
      to_year,
      to_month,
      to_day,
    } = body

    const ageMin = this.#convertAge(from_year, from_month, from_day)
    const ageMax = this.#convertAge(to_year, to_month, to_day)
    if (ageMin > ageMax) {
      throw new ValidationError(
        c.var.t("validator.invalid_submit_group_target_age")
      )
    }

    const result = await this.repository.findOne(c, { title })
    if (result) {
      throw new ValidationError(
        c.var.t("validator.invalid_submit_group_target_already_exist")
      )
    }

    return body
  }

  update = async (c: Context, body: UpdateGroupTargetRequest) => {
    const { title } = body
    const id = c.req.param("id")
    // If title exists, require all date fields
    if (title) {
      const requiredFields = [
        "from_year",
        "from_month",
        "from_day",
        "to_year",
        "to_month",
        "to_day",
      ]

      for (const field of requiredFields) {
        if (body[field] === undefined || body[field] === null) {
          throw new ValidationError(
            c.var.t("validator.invalid_update_target_group_title", { field })
          )
        }
      }

      // Validate age
      const ageMin = this.#convertAge(
        body.from_year!,
        body.from_month!,
        body.from_day!
      )
      const ageMax = this.#convertAge(
        body.to_year!,
        body.to_month!,
        body.to_day!
      )

      if (ageMin > ageMax) {
        throw new ValidationError(
          c.var.t("validator.invalid_submit_group_target_age")
        )
      }
    }

    const result = await this.repository.findOne(c, { id })
    if (!result) {
      throw new ValidationError(
        c.var.t("validator.invalid_submit_group_target_not_exist")
      )
    }

    if (result.title.toUpperCase() !== title?.toUpperCase()) {
      const resultTitle = await this.repository.findOne(c, { title })
      if (resultTitle) {
        throw new ValidationError(
          c.var.t("validator.invalid_submit_group_target_already_exist")
        )
      }
    }

    return body
  }

  validateImport = async (
    c: Context,
    rows: ImportTargetGroupRequest,
    template: BaseTemplate
  ) => {
    const startRow = template.getStartRow()
    const listGroupTarget = await this.repository.getActiveTargetGroups(c)
    const rowsDataEntry = [] as ImportTargetGroupRequest
    rows.forEach((row, index) => {
      const rowIdx = String(index + startRow)

      // Validate age
      const ageMin = this.#convertAge(
        row.from_year,
        row.from_month,
        row.from_day
      )
      const ageMax = this.#convertAge(row.to_year, row.to_month, row.to_day)
      if (ageMin > ageMax) {
        c.addError(rowIdx, "validator.invalid_submit_group_target_age")
      }

      // Check existing name in DB
      const isExist = listGroupTarget.find((item) => item.title === row.name)
      if (isExist) {
        c.addError(
          rowIdx,
          "validator.invalid_submit_group_target_already_exist",
          row.name
        )
      }

      // Check duplicate row
      const idx = rowsDataEntry.findIndex((item) => item.name === row.name)
      if (idx !== -1) {
        c.addError(rowIdx, "validator.duplicate_group_target_name", row.name)
      } else {
        rowsDataEntry.push(row)
      }
    })

    if (c.var.errors) {
      throw new ValidationError()
    }

    return rows
  }
}
