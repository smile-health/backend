import { BOTTOM_UP_TOP_DOWN } from "@/common/constants/activity.js"
import { BaseMiddleware } from "@smile/lib/base/middleware.js"
import {
  BadRequestError,
  NotFoundError,
  ValidationError,
} from "@smile/lib/error.js"
import { formatExcelErrors } from "@smile/lib/zod.js"
import { Context } from "hono"
import { createMiddleware } from "hono/factory"
import { validator } from "hono/validator"
import z from "zod"
import { ProgramRepository } from "../program/program.repository.js"
import { ActivityExcel } from "./activity.excel.js"
import { ActivityRepository } from "./activity.repository.js"
import {
  COL,
  CreateActivityRequest,
  CreateActivityRequestSchema,
  GetActivityQuerySchema,
  ImportActivityArrayRequest,
  ImportActivityArrayRequestSchema,
  ImportActivityRowRequest,
  UpdateActivityRequest,
  UpdateActivityRequestSchema,
} from "./activity.schema.js"

export class ActivityMiddleware extends BaseMiddleware {
  constructor(
    private readonly repository: ActivityRepository,
    private readonly programRepo: ProgramRepository
  ) {
    super()
  }

  readonly #getProgramId = async (c: Context) => {
    const programId = c.req.param("program_id")
    if (isNaN(Number(programId))) {
      throw new BadRequestError(
        c.var.t("validator.number", {
          field: c.var.t("common.program"),
        })
      )
    }
    const exist = await this.programRepo.findOne(c, { id: programId })
    if (!exist) {
      throw new BadRequestError(
        c.var.t("validator.not_exist", {
          field: c.var.t("common.program"),
        })
      )
    }

    return Number(programId)
  }

  validateProgramId = createMiddleware(async (c, next) => {
    await this.#getProgramId(c)
    await next()
  })

  readonly #setNewRowImport = (rows) => {
    const newRows = rows.map((obj) => {
      const newObj = {}

      if (obj["Name"] || obj["Nama"]) {
        newObj["name"] = obj["Name"] ?? obj["Nama"]
      }

      if (obj["Bottom Up Process"] || obj["Proses Bottom Up"]) {
        newObj["is_ordered_sales"] =
          obj["Bottom Up Process"] ?? obj["Proses Bottom Up"]
      }

      if (obj["Top Down Process"] || obj["Proses Top Down"]) {
        newObj["is_ordered_purchase"] =
          obj["Top Down Process"] ?? obj["Proses Top Down"]
      }

      if (obj["Protocol"] || obj["Protokol"]) {
        newObj["protocol"] = obj["Protocol"] ?? obj["Protokol"]
      }

      return newObj
    })
    return newRows
  }

  readonly #generateImportData = async (c: Context) => {
    const body = await c.req.parseBody()
    const file = body.file as File
    const usedTemplate = new ActivityExcel(11, 1)
    await usedTemplate.loadFromBuffer(await file.arrayBuffer())
    const rows = usedTemplate.getRows()
    const startRow = usedTemplate.getStartRow()

    const rowsResult = this.#setNewRowImport(rows)

    const usedSchema = ImportActivityArrayRequestSchema.superRefine(
      async (data, ctx) => {
        if (data.length === 0) {
          this.#rowsCannotEmpty(c, ctx)
        } else {
          this.#checkDuplicateOnSheet(data, ctx)
          await this.#createdNameArrayIsExists(c, data, ctx)
          this.#bothCannotHaveZeroArrayValue(data, ctx)
        }
      }
    ).transform((rows) => rows.map(this.transformRowSchema))

    const result = await usedSchema.safeParseAsync(rowsResult)

    if (!result.success) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newError: any = { issues: [] }

      for (const err of result.error.issues) {
        if (err.message === "validator.selected_atleast_one") {
          if (err.path[1] === "is_ordered_sales") {
            newError.issues.push({
              path: err.path,
              message: c.var.t("validator.selected_atleast_one", {
                field1: c.var.t("activity.label.is_ordered_sales"),
                field2: c.var.t("activity.label.is_ordered_purchase"),
              }),
              code: z.ZodIssueCode.custom,
            })
          } else {
            newError.issues.push({
              path: err.path,
              message: c.var.t("validator.selected_atleast_one", {
                field1: c.var.t("activity.label.is_ordered_purchase"),
                field2: c.var.t("activity.label.is_ordered_sales"),
              }),
              code: z.ZodIssueCode.custom,
            })
          }
        } else {
          newError.issues.push({
            path: err.path,
            message: c.var.t(err.message, {
              field: c.var.t(`activity.label.${err.path[1]}`),
            }),
            code: z.ZodIssueCode.custom,
          })
        }
      }

      c.set("errors", formatExcelErrors(newError, startRow, c.var.t))
      throw new ValidationError()
    }

    return result.data
  }

  transformRowSchema = (
    row: ImportActivityRowRequest
  ): CreateActivityRequest => {
    const toBoolInt = (value: unknown) =>
      String(value).toUpperCase() === BOTTOM_UP_TOP_DOWN.YES ? 1 : 0

    return {
      name: row[COL.Name],
      protocol: row[COL.Protocol],
      is_ordered_sales: toBoolInt(row[COL.BottomUp]),
      is_ordered_purchase: toBoolInt(row[COL.TopDown]),
    }
  }

  readonly #rowsCannotEmpty = (c: Context, ctx) => {
    ctx.addIssue({
      path: ["rows"],
      message: c.var.t("validator.not_empty", {
        field: c.var.t("common.rows"),
      }),
      code: z.ZodIssueCode.custom,
    })
  }

  readonly #bothCannotHaveZeroValue = (
    c: Context,
    data: CreateActivityRequest,
    ctx
  ) => {
    if (data.is_ordered_purchase === 0 && data.is_ordered_sales === 0) {
      ctx.addIssue({
        path: ["is_ordered_sales"],
        message: c.var.t("validator.selected_atleast_one", {
          field1: c.var.t("activity.label.is_ordered_sales"),
          field2: c.var.t("activity.label.is_ordered_purchase"),
        }),
        code: z.ZodIssueCode.custom,
      })

      ctx.addIssue({
        path: ["is_ordered_purchase"],
        message: c.var.t("validator.selected_atleast_one", {
          field1: c.var.t("activity.label.is_ordered_purchase"),
          field2: c.var.t("activity.label.is_ordered_sales"),
        }),
        code: z.ZodIssueCode.custom,
      })
    }
  }

  readonly #bothCannotHaveZeroArrayValue = (
    data: ImportActivityArrayRequest,
    ctx
  ) => {
    data.forEach((d, index) => {
      if (
        String(d[COL.BottomUp]).toUpperCase() === BOTTOM_UP_TOP_DOWN.NO &&
        String(d[COL.TopDown]).toUpperCase() === BOTTOM_UP_TOP_DOWN.NO
      ) {
        ctx.addIssue({
          path: [index, "is_ordered_sales"],
          message: "validator.selected_atleast_one",
          code: z.ZodIssueCode.custom,
        })

        ctx.addIssue({
          path: [index, "is_ordered_purchase"],
          message: "validator.selected_atleast_one",
          code: z.ZodIssueCode.custom,
        })
      }
    })
  }

  readonly #createdNameIsExists = async (
    c: Context,
    data: CreateActivityRequest,
    ctx
  ) => {
    const program_id = Number(c.req.param("program_id"))
    if (data.name && typeof data.name === "string") {
      const created = await this.repository.findByName(c, data.name, program_id)
      if (created) {
        ctx.addIssue({
          path: ["name"],
          message: "validator.exist",
          code: z.ZodIssueCode.custom,
        })
      }
    }
  }

  readonly #checkDuplicateOnSheet = async (
    data: ImportActivityArrayRequest,
    ctx
  ) => {
    const checkDuplicateNameList: string[] = []
    for (const [index, d] of data.entries()) {
      if (d[COL.Name] && typeof d[COL.Name] === "string") {
        if (checkDuplicateNameList.includes(String(d[COL.Name]))) {
          ctx.addIssue({
            path: [index, "name"],
            message: "validator.duplicated",
            code: z.ZodIssueCode.custom,
          })
        } else {
          checkDuplicateNameList.push(String(d[COL.Name]))
        }
      }
    }
  }

  readonly #createdNameArrayIsExists = async (
    c: Context,
    data: ImportActivityArrayRequest,
    ctx
  ) => {
    const programId = Number(c.req.param("program_id"))
    for (const [index, d] of data.entries()) {
      if (d[COL.Name] && typeof d[COL.Name] === "string") {
        const created = await this.repository.findByName(
          c,
          String(d[COL.Name]),
          programId
        )
        if (created) {
          console.log(created.name)
          ctx.addIssue({
            path: [index, "name"],
            message: "validator.exist",
            code: z.ZodIssueCode.custom,
          })
        }
      }
    }
  }

  readonly #updatedNameIsExists = async (
    c: Context,
    data: UpdateActivityRequest,
    ctx
  ) => {
    if (data.name && typeof data.name === "string") {
      const id = c.req.param("id") ?? undefined
      const updated = await this.repository.findByName(
        c,
        data.name,
        c.get("programId")
      )
      if (updated && updated.id !== Number(id)) {
        ctx.addIssue({
          path: ["name"],
          message: "validator.exist",
          code: z.ZodIssueCode.custom,
        })
      }
    }
  }

  readonly #updatedIdNotExists = async (c: Context, ctx) => {
    const programId = Number(c.req.param("program_id"))
    const id = c.req.param("id") ?? undefined
    if (id) {
      const exists = await this.repository.findById(c, Number(id), programId)
      if (!exists) {
        ctx.addIssue({
          path: ["id"],
          message: "validator.not_exist",
          code: z.ZodIssueCode.custom,
        })
      }
    }
  }

  readonly #IdNotExistsOrHasDeleted = async (c: Context, programId: number) => {
    const id = c.req.param("id") ?? undefined
    if (id) {
      const exists = await this.repository.findById(c, Number(id), programId)
      if (!exists)
        throw new NotFoundError(
          c.var.t("validator.not_exist", {
            field: c.var.t("activity.label.id"),
          })
        )
      if (exists?.deleted_at)
        throw new ValidationError(
          c.var.t("validator.delete", {
            field: c.var.t("activity.label.id"),
          })
        )
    }
  }

  detail = createMiddleware(async (c, next) => {
    const programId = await this.#getProgramId(c)
    await this.#IdNotExistsOrHasDeleted(c, programId)
    await next()
  })

  create = (c: Context) => {
    return CreateActivityRequestSchema.superRefine(async (data, ctx) => {
      await this.#createdNameIsExists(c, data, ctx)
      this.#bothCannotHaveZeroValue(c, data, ctx)
    })
  }

  update = (c: Context) => {
    return UpdateActivityRequestSchema.extend({
      protocol: z.string().nullish().optional(),
    }).superRefine(async (data, ctx) => {
      await this.#updatedIdNotExists(c, ctx)
      await this.#updatedNameIsExists(c, data, ctx)
      this.#bothCannotHaveZeroValue(c, data, ctx)
    })
  }

  status = (c: Context) => {
    const id = c.req.param("id")
    return z
      .object({
        status: z.boolean(),
      })
      .superRefine(async (data, ctx) => {
        const { status } = data
        if (isNaN(Number(id))) {
          ctx.addIssue({
            path: ["id"],
            message: "validator.number",
            code: z.ZodIssueCode.custom,
          })
          return
        }

        await this.#updatedIdNotExists(c, ctx)
        const [trxData, orderData, stockData] = await Promise.all([
          this.repository.findTransactionByActivityId(c, Number(id)),
          this.repository.findOrderByActivityId(c, Number(id)),
          this.repository.findStockGreaterThanZeroByActivityId(c, Number(id)),
        ])

        const errorDataExist = (message) => {
          ctx.addIssue({
            path: ["status"],
            message: c.var.t(`validator.${message}`, {
              field: c.var.t("common.status"),
            }),
            code: z.ZodIssueCode.custom,
          })
        }

        if (status) return

        if (trxData) errorDataExist("update_has_transaction_not_material")

        if (orderData) errorDataExist("update_has_order")

        if (stockData && stockData.qty > 0) errorDataExist("update_has_stock")
      })
  }

  import = validator("json", async (value, c) => {
    const result = await this.#generateImportData(c)
    return result
  })

  list = (c: Context) => {
    return GetActivityQuerySchema.superRefine(async (val, cfx) => {
      await this.#getProgramId(c)
      const { sort_by, sort_type } = val
      const sortBys = ["name", "updated_at", "status"]
      const sortTypes = ["asc", "desc"]

      if (sort_by && !sortBys.includes(sort_by)) {
        cfx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["sort_by"],
          message: c.var.t("validator.one_of", {
            field: "sort_by",
            condition: sortBys,
          }),
        })
      }

      if (sort_type && !sortTypes.includes(sort_type)) {
        cfx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["sort_type"],
          message: c.var.t("validator.one_of", {
            field: "sort_type",
            condition: sortTypes,
          }),
        })
      }
    })
  }
}
