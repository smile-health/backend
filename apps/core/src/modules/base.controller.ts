/* eslint-disable @typescript-eslint/no-unused-vars */
import { DB } from "@/common/infrastructure/database/types/db.js"
import { BadRequestError, ValidationError } from "@smile-health/lib/error.js"
import { ImportTemplate } from "@smile-health/lib/excel.js"
import { Consumer } from "@smile-health/lib/rabbitmq"
import { translateError } from "@smile-health/lib/zod.js"
import { Context, Hono } from "hono"
import { validator } from "hono/validator"
import { ZodError, ZodSchema } from "zod"

export class BaseController {
  public getRoutes(): Hono {
    throw new BadRequestError("Not implemented")
  }

  public registerWorkers(consumer: Consumer<DB>) {
    throw new BadRequestError("Not implemented")
  }

  protected validateRequest<T extends ZodSchema>(
    type: "json" | "param" | "query" | "header",
    schema: T | ((c: Context) => T)
  ) {
    return validator(
      type,
      async (value, c): Promise<ReturnType<T["parse"]>> => {
        schema = typeof schema === "function" ? schema(c) : schema
        const result = await schema.safeParseAsync(value)
        if (result.success) {
          return result.data
        }

        c.set("errors", this.formatErrors(c, result.error))
        throw new ValidationError()
      }
    )
  }

  protected validateExcelRequest<T extends ZodSchema>(
    schema: T | ((c: Context) => T),
    template: ImportTemplate | ((c: Context) => ImportTemplate)
  ) {
    return validator(
      "json",
      async (value, c): Promise<ReturnType<T["parse"]>> => {
        schema = typeof schema === "function" ? schema(c) : schema
        template = typeof template === "function" ? template(c) : template

        await template.loadFromBuffer(await c.req.arrayBuffer())
        const rows = template.getRows()
        const columns = template.getColumns()
        const startRow = template.getStartRow()
        const result = await schema.safeParseAsync(rows)
        const errors = {}

        if (result.success) {
          return result.data
        }

        for (const err of result.error.issues) {
          if (err.path.length === 2) {
            const row = `${startRow + Number(err.path[0])}`
            const col = Number(err.path[1])
            err.path = columns[col] ? [columns[col]] : [`Column ${col + 1}`]

            if (!errors[row]) {
              errors[row] = []
            }

            errors[row].push(translateError(err, c.var.t))
          }
        }

        c.set("errors", errors)

        throw new ValidationError()
      }
    )
  }

  private formatErrors(c: Context, error: ZodError) {
    const errorObject = {}

    for (const issue of error.issues) {
      let current = errorObject
      const path = issue.path

      path.forEach((key, index) => {
        if (index === path.length - 1) {
          if (!current[key]) {
            current[key] = []
          }
          current[key].push(translateError(issue, c.var.t))
        } else {
          current[key] = current[key] || {}
          current = current[key]
        }
      })
    }

    return errorObject
  }
}
