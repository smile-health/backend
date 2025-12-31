import { ValidationError, NotFoundError } from "@smile/lib/error.js"
import { BaseMiddleware } from "@smile/lib/base/middleware.js"
import { formatExcelErrors } from "@smile/lib/zod.js"
import { Context } from "hono"
import { createMiddleware } from "hono/factory"
import { validator } from "hono/validator"
import { ActivityImport } from "./activity.excel.js"
import { ActivityRepository } from "./activity.repository.js"
import {
  COL,
  CreateActivityRequestSchema,
  UpdateActivityRequestSchema,
  ImportActivityArrayRequestSchema,
  CreateActivityRequest,
  UpdateActivityRequest,
  ImportActivityRowRequest,
  ImportActivityArrayRequest,
} from "./activity.schema.js"
import { BOTTOM_UP_TOP_DOWN } from "@/common/constants/activity.js"
import z from "zod"

export class ActivityMiddleware extends BaseMiddleware {
  constructor(private repository: ActivityRepository) {
    super()
  }

  #generateImportData = async (c: Context) => {
    const body = await c.req.parseBody()
    const file = body.file as File
    const usedTemplate = new ActivityImport()
    await usedTemplate.loadFromBuffer(await file.arrayBuffer())
    const rows = usedTemplate.getRows()
    const startRow = usedTemplate.getStartRow()

    const rowsResult = rows.map((obj) => {
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

      return newObj
    })

    const usedSchema = ImportActivityArrayRequestSchema.superRefine(
      async (data, ctx) => {
        if (data.length === 0) {
          this.#rowsCannotEmpty(c, ctx)
        } else {
          await this.#createdNameArrayIsExists(c, data, ctx)
          this.#bothCannotHaveZeroArrayValue(c, data, ctx)
        }
      }
    ).transform((rows) => rows.map(this.transformRowSchema))

    const result = await usedSchema.safeParseAsync(rowsResult)

    if (!result.success) {
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

  transformRowSchema = (row: ImportActivityRowRequest) =>
    ({
      name: row[COL.Name],
      is_ordered_sales:
        String(row[COL.BottomUp]).toUpperCase() === BOTTOM_UP_TOP_DOWN.YES
          ? 1
          : 0,
      is_ordered_purchase:
        String(row[COL.TopDown]).toUpperCase() === BOTTOM_UP_TOP_DOWN.YES
          ? 1
          : 0,
    }) as CreateActivityRequest

  #rowsCannotEmpty = (c: Context, ctx) => {
    ctx.addIssue({
      path: ["rows"],
      message: c.var.t("validator.not_empty", {
        field: c.var.t("common.rows"),
      }),
      code: z.ZodIssueCode.custom,
    })
  }

  #bothCannotHaveZeroValue = (c: Context, data: CreateActivityRequest, ctx) => {
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

  #bothCannotHaveZeroArrayValue = (
    c: Context,
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

  #createdNameIsExists = async (
    c: Context,
    data: CreateActivityRequest,
    ctx
  ) => {
    if (data.name && typeof data.name === "string") {
      const created = await this.repository.findByName(c, data.name)
      if (created) {
        ctx.addIssue({
          path: ["name"],
          message: "validator.exist",
          code: z.ZodIssueCode.custom,
        })
      }
    }
  }

  #createdNameArrayIsExists = async (
    c: Context,
    data: ImportActivityArrayRequest,
    ctx
  ) => {
    for (const [index, d] of data.entries()) {
      if (d[COL.Name] && typeof d[COL.Name] === "string") {
        const created = await this.repository.findByName(c, String(d[COL.Name]))
        if (created) {
          // console.log(index)
          console.log(created.name)
          ctx.addIssue({
            path: [index, "name"],
            // message: c.var.t("validator.exist", {
            //   field: c.var.t("activity.label.name"),
            // }),
            message: "validator.exist",
            code: z.ZodIssueCode.custom,
          })
        }
      }
    }
  }

  #updatedNameIsExists = async (
    c: Context,
    data: UpdateActivityRequest,
    ctx
  ) => {
    if (data.name && typeof data.name === "string") {
      const id = c.req.param("id") ?? undefined
      const updated = await this.repository.findByName(c, data.name)
      if (updated && updated.id !== Number(id)) {
        ctx.addIssue({
          path: ["name"],
          message: "validator.exist",
          code: z.ZodIssueCode.custom,
        })
      }
    }
  }

  #updatedIdNotExists = async (c: Context, ctx) => {
    const id = c.req.param("id") ?? undefined
    if (id) {
      const exists = await this.repository.findById(c, Number(id))
      if (!exists) {
        ctx.addIssue({
          path: ["id"],
          message: "validator.not_exist",
          code: z.ZodIssueCode.custom,
        })
      }
    }
  }

  #IdNotExistsOrHasDeleted = async (c: Context) => {
    const id = c.req.param("id") ?? undefined
    if (id) {
      const exists = await this.repository.findDynamicActivityId<number>(
        c,
        "id",
        "=",
        Number(id)
      )
      if (!exists)
        throw new NotFoundError(
          c.var.t("validator.not_exist", {
            field: c.var.t("activity.label.id"),
          })
        )
      if (exists && exists.deleted_at)
        throw new ValidationError(
          c.var.t("validator.delete", {
            field: c.var.t("activity.label.id"),
          })
        )
    }
  }

  detail = createMiddleware(async (c, next) => {
    await this.#IdNotExistsOrHasDeleted(c)
    await next()
  })

  create = (c: Context) => {
    return CreateActivityRequestSchema.superRefine(async (data, ctx) => {
      await this.#createdNameIsExists(c, data, ctx)
      this.#bothCannotHaveZeroValue(c, data, ctx)
    })
  }

  update = (c: Context) => {
    return UpdateActivityRequestSchema.superRefine(async (data, ctx) => {
      await this.#updatedIdNotExists(c, ctx)
      await this.#updatedNameIsExists(c, data, ctx)
      this.#bothCannotHaveZeroValue(c, data, ctx)
    })
  }

  delete = createMiddleware(async (c, next) => {
    await this.#IdNotExistsOrHasDeleted(c)
    await next()
  })

  import = validator("json", async (value, c) => {
    const result = await this.#generateImportData(c)
    return result
  })
}
