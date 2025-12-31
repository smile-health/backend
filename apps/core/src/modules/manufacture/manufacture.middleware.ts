import { IMPORT_START_ROW } from "@/common/constants/manufacture.js"
import { ValidationError } from "@smile/lib/error.js"
import { PROCESSOR } from "@smile/lib/excel/types.js"
import { collect } from "@smile/lib/utils.js"
import { formatErrors, translateError } from "@smile/lib/zod.js"
import { Context } from "hono"
import { validator } from "hono/validator"
import z from "zod"
import { WorkspaceRepository } from "../workspace/workspace.repository.js"
import { ManufactureTemplateXlsx } from "./manufacture.excel.js"
import { ManufactureRepository } from "./manufacture.repository.js"
import {
  ManufactureCreateRequestSchema,
  ManufactureImportRequestDTO,
  ManufactureImportRequestSchema,
  ManufactureUpdateRequestSchema,
} from "./manufacture.schema.js"

export class ManufactureMiddleware {
  constructor(
    private readonly repository: ManufactureRepository,
    private readonly workspaceRepo: WorkspaceRepository
  ) {}

  readonly #isNameExist = async (c: Context, name: string | undefined) => {
    const exists = await this.repository.find(c, { name })
    return exists.length > 0
  }

  readonly #isTypeExist = async (c: Context, type: number | undefined) => {
    if (type === undefined) return false
    return !!(await this.repository.findByTypeID(c, type))
  }

  readonly #isWorkspaceExist = async (
    c: Context,
    program_ids: number[] | undefined
  ) => {
    if (!program_ids?.length) return false
    const workspaceIDs = await this.workspaceRepo.getIDs(c)
    return program_ids.every((id) => workspaceIDs.includes(id))
  }

  readonly #isSameAsPreviousData = async (
    c: Context,
    name: string | undefined
  ) => {
    const id = c.req.param("id")
    const previousData = await this.repository.find(c, { id: Number(id) })
    if (
      previousData &&
      !previousData[0]?.deleted_at &&
      previousData[0]?.name !== name
    ) {
      const isNameExist = await this.#isNameExist(c, name)
      return !isNameExist
    }

    return true
  }

  readonly #isWorkspaceIncluded = async (c: Context, program_ids: number[]) => {
    const { id } = c.req.param()
    const workspaceIDs = collect(
      await this.workspaceRepo.findDynamic(
        c,
        "manufacture_workspaces",
        "manufacture_workspaces.manufacture_id",
        "=",
        id,
        true
      ),
      "workspace_id"
    )

    let count = 0
    program_ids.forEach((workSpaceId) => {
      if (workspaceIDs.includes(workSpaceId)) {
        count++
      }
    })

    if (count < workspaceIDs.length) {
      return false
    }

    return true
  }

  async #getExcelRows(c: Context) {
    const excelTemplate = new ManufactureTemplateXlsx(PROCESSOR.SHEETJS)
    await excelTemplate.loadFromBuffer(
      Buffer.from(c.get("fileRequest")["buffer"])
    )

    const rows = excelTemplate.getRows(c.var.t("common.data_entry"))
    if (!rows.length) {
      throw new ValidationError("No Content can be parsed")
    }

    return rows
  }

  #stringToNumberArray(input, delimiter = ";") {
    if (!input) return []

    if (!input.includes(delimiter)) {
      const num = Number(input.trim())
      return isNaN(num) ? [] : [num]
    }

    return input
      .split(delimiter)
      .map((item) => item.trim())
      .filter((item) => item !== "")
      .map(Number)
      .filter((num) => !isNaN(num))
  }

  #manufactureColumns(c) {
    return {
      Name: c.var.t("manufacture.label.name"),
      Type: c.var.t("manufacture.label.type"),
      Description: c.var.t("manufacture.label.description"),
      ContactName: c.var.t("manufacture.label.contact_name"),
      PhoneNumber: c.var.t("manufacture.label.phone_number"),
      Email: c.var.t("manufacture.label.email"),
      Address: c.var.t("manufacture.label.address"),
      ProgramId: c.var.t("manufacture.label.program_id"),
    }
  }

  #manufactureSchema(ManufactureColumnsExcel) {
    return z
      .object({
        [ManufactureColumnsExcel.Name]:
          ManufactureImportRequestSchema.shape.name,
        [ManufactureColumnsExcel.Type]:
          ManufactureImportRequestSchema.shape.type,
        [ManufactureColumnsExcel.Description]:
          ManufactureImportRequestSchema.shape.description,
        [ManufactureColumnsExcel.ContactName]:
          ManufactureImportRequestSchema.shape.contact_name,
        [ManufactureColumnsExcel.PhoneNumber]:
          ManufactureImportRequestSchema.shape.phone_number,
        [ManufactureColumnsExcel.Email]:
          ManufactureImportRequestSchema.shape.email,
        [ManufactureColumnsExcel.Address]:
          ManufactureImportRequestSchema.shape.address,
        [ManufactureColumnsExcel.ProgramId]:
          ManufactureImportRequestSchema.shape.program_id,
      })
      .transform((row) => ({
        name: row[ManufactureColumnsExcel.Name],
        type: row[ManufactureColumnsExcel.Type],
        description: row[ManufactureColumnsExcel.Description],
        contact_name: row[ManufactureColumnsExcel.ContactName],
        phone_number: row[ManufactureColumnsExcel.PhoneNumber],
        email: row[ManufactureColumnsExcel.Email],
        address: row[ManufactureColumnsExcel.Address],
        program_id: this.#stringToNumberArray(
          String(row[ManufactureColumnsExcel.ProgramId])
        ),
      }))
  }

  #parseRow(row, schema, columns, c, mapError, rowKey) {
    const parsed = schema.safeParse(row)

    if (!parsed.success) {
      parsed.error.issues.forEach((issue) => {
        issue.path = issue.path.filter((p) => isNaN(Number(p)))

        if (
          (issue.path.includes(columns.PhoneNumber) ||
            issue.path.includes(columns.Email)) &&
          issue.code === "invalid_string"
        ) {
          issue.message = "validator.string"
        }

        issue.path = [`${issue.path}`]
        mapError[rowKey].push(translateError(issue, c.var.t))
      })
    }

    return parsed
  }

  async #validateRow(row, columns, c, mapError, rowKey, nameSet) {
    const name = String(row[columns.Name])
    if (await this.#isNameExist(c, name)) {
      mapError[rowKey].push(
        c.var.t("validator.exist", { field: [columns.Name] })
      )
    }

    if (nameSet.has(name)) {
      mapError[rowKey].push(
        c.var.t("validator.duplicated", { field: columns.Name })
      )
    } else {
      nameSet.add(name)
    }

    const type = Number(row[columns.Type])
    if (!(await this.#isTypeExist(c, type))) {
      mapError[rowKey].push(
        c.var.t("validator.not_exist", { field: [columns.Type] })
      )
    }

    const programIds = this.#stringToNumberArray(String(row[columns.ProgramId]))
    if (
      Array.isArray(programIds) &&
      programIds.length > 0 &&
      !(await this.#isWorkspaceExist(c, programIds))
    ) {
      mapError[rowKey].push(
        c.var.t("validator.not_exist", { field: [columns.ProgramId] })
      )
    }
  }

  #removeEmptyArrays(mapError) {
    Object.keys(mapError).forEach((key) => {
      if (Array.isArray(mapError[key]) && mapError[key].length === 0) {
        delete mapError[key]
      }
    })
  }

  async #parseAndValidateExcel(c: Context, rows: object[]) {
    const ManufactureColumnsExcel = this.#manufactureColumns(c)
    const ManufactureSchemaExcel = this.#manufactureSchema(
      ManufactureColumnsExcel
    )

    const mapError = {}
    const nameSet = new Set<string>()
    const result: ManufactureImportRequestDTO[] = []

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index]
      const rowKey = `row ${index + IMPORT_START_ROW}`
      mapError[rowKey] = []

      const parsed = this.#parseRow(
        row,
        ManufactureSchemaExcel,
        ManufactureColumnsExcel,
        c,
        mapError,
        rowKey
      )

      await this.#validateRow(
        row,
        ManufactureColumnsExcel,
        c,
        mapError,
        rowKey,
        nameSet
      )

      if (parsed.success) {
        result.push(parsed.data)
      }
    }

    this.#removeEmptyArrays(mapError)

    if (Object.keys(mapError).length) {
      c.set("errors", mapError)
      throw new ValidationError()
    }

    return result
  }

  /*
   * Create Middleware
   */
  create = (c: Context) => {
    return z.preprocess(async (input) => {
      const result = await ManufactureCreateRequestSchema.safeParseAsync(input)

      const parsed = {
        success: result.success,
        data: result.success ? result.data : input,
        error: result.success ? new z.ZodError([]) : result.error,
      }

      parsed.error.issues.forEach((issue) => {
        issue.path = issue.path.filter((p) => isNaN(Number(p)))

        if (
          (issue.path.includes("phone_number") ||
            issue.path.includes("email")) &&
          issue.code === "invalid_string"
        ) {
          issue.message = "validator.string"
        }
      })

      const name = (input as Record<string, string>).name
      const type = (input as Record<string, number>).type
      const program_ids = (input as Record<string, number[]>).program_ids

      const nameExist = await this.#isNameExist(c, name)
      if (nameExist) {
        parsed.success = false
        parsed.error.issues.push({
          code: z.ZodIssueCode.custom,
          path: ["name"],
          message: "validator.exist",
        })
      }

      const typeExist = await this.#isTypeExist(c, type)
      if (!typeExist) {
        parsed.success = false
        parsed.error.issues.push({
          code: z.ZodIssueCode.custom,
          path: ["type"],
          message: "validator.not_exist",
        })
      }

      if (Array.isArray(program_ids) && program_ids.length > 0) {
        const workspaceExist = await this.#isWorkspaceExist(c, program_ids)
        if (!workspaceExist) {
          parsed.success = false
          parsed.error.issues.push({
            code: z.ZodIssueCode.custom,
            path: ["program_ids"],
            message: "validator.not_exist",
          })
        }
      }

      if (!parsed.success) {
        c.set("errors", formatErrors(parsed.error, c.var.t, "manufacture"))
        throw new ValidationError()
      }

      return input
    }, ManufactureCreateRequestSchema)
  }

  /*
   * Update Middleware
   */
  update = (c: Context) => {
    return z.preprocess(async (input) => {
      const result = await ManufactureUpdateRequestSchema.safeParseAsync(input)

      const keys = Object.keys(input as Record<string, unknown>)
      if (keys.length === 1 && keys[0] === "status") {
        return input
      }

      const parsed = {
        success: result.success,
        data: result.success ? result.data : input,
        error: result.success ? new z.ZodError([]) : result.error,
      }

      parsed.error.issues.forEach((issue) => {
        issue.path = issue.path.filter((p) => isNaN(Number(p)))

        if (
          (issue.path.includes("phone_number") ||
            issue.path.includes("email")) &&
          issue.code === "invalid_string"
        ) {
          issue.message = "validator.string"
        }
      })

      const name = (input as Record<string, string>).name
      const type = (input as Record<string, number>).type
      const program_ids = (input as Record<string, number[]>).program_ids

      const previousData = await this.#isSameAsPreviousData(c, name)
      if (!previousData) {
        parsed.success = false
        parsed.error.issues.push({
          code: z.ZodIssueCode.custom,
          path: ["name"],
          message: "validator.exist",
        })
      }

      const typeExist = await this.#isTypeExist(c, type)
      if (!typeExist) {
        parsed.success = false
        parsed.error.issues.push({
          code: z.ZodIssueCode.custom,
          path: ["type"],
          message: "validator.not_exist",
        })
      }

      if (Array.isArray(program_ids) && program_ids.length > 0) {
        const workspaceExist = await this.#isWorkspaceExist(c, program_ids)
        if (!workspaceExist) {
          parsed.success = false
          parsed.error.issues.push({
            code: z.ZodIssueCode.custom,
            path: ["program_ids"],
            message: "validator.not_exist",
          })
        }

        const workspaceIncluded = await this.#isWorkspaceIncluded(
          c,
          program_ids
        )
        if (!workspaceIncluded) {
          parsed.success = false
          parsed.error.issues.push({
            code: z.ZodIssueCode.custom,
            path: ["program_ids"],
            message: "validator.unmatch",
          })
        }
      }

      if (!parsed.success) {
        c.set("errors", formatErrors(parsed.error, c.var.t, "manufacture"))
        throw new ValidationError()
      }

      return input
    }, ManufactureUpdateRequestSchema)
  }

  /*
   * Excel Middleware
   */
  excel = validator("json", async (val, c) => {
    const rows = await this.#getExcelRows(c)
    const result = await this.#parseAndValidateExcel(c, rows)

    return result
  })
}
