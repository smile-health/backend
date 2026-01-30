/* eslint-disable @typescript-eslint/no-unused-vars */
import { DB } from "@/common/infrastructure/database/types/db.js"
import { BadRequestError, ValidationError } from "@smile-health/lib/error.js"
import { Consumer } from "@smile-health/lib/rabbitmq"
import { formatErrors } from "@smile-health/lib/zod.js"
import { Context, Hono } from "hono"
import { validator } from "hono/validator"
import { ZodSchema } from "zod"

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
        const usedSchema = typeof schema === "function" ? schema(c) : schema
        const result = await usedSchema.safeParseAsync(value)
        if (result.success) {
          return result.data
        }

        c.set("errors", formatErrors(result.error, c.var.t, "common"))
        throw new ValidationError()
      }
    )
  }
}
