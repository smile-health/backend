import { ValidationError } from "@smile/lib/error.js"
import { Context } from "hono"
import { validator } from "hono/validator"
import { ZodSchema } from "zod"
import { formatErrorsWithData } from "./transaction.zod.js"

export type AsyncCallback<T> = (c: Context, data: T) => Promise<T>

export class BaseController {
  constructor(protected key?: string) {}

  protected validateRequest<T extends ZodSchema>(
    type: "json" | "param" | "query" | "header",
    schema: T | ((c: Context) => T) | ((c: Context) => Promise<T>),
    callback?: AsyncCallback<ReturnType<T["parse"]>>
  ) {
    return validator(
      type,
      async (value, c): Promise<ReturnType<T["parse"]>> => {
        const usedSchema =
          typeof schema === "function" ? await schema(c) : schema
        const result = await usedSchema.safeParseAsync(value)
        if (!result.success) {
          c.set("errors", formatErrorsWithData(result.error, c.var.t, this.key))
          throw new ValidationError()
        }

        if (callback) {
          return await callback(c, result.data)
        }

        return result.data
      }
    )
  }
}
