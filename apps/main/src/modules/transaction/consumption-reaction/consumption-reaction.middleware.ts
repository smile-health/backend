import { ValidationError } from "@smile-health/lib/error.js"
import { formatErrors } from "@smile-health/lib/zod.js"
import { Context } from "hono"
import moment from "moment"
import z from "zod"
import { ConsumptionReactionRepository } from "./consumption-reaction.repository.js"
import { ConsumptionReactionRequestSchema } from "./consumption-reaction.schema.js"

export class ConsumptionReactionMiddleware {
  constructor(private readonly repo: ConsumptionReactionRepository) {}

  create = (c: Context) => {
    return z.preprocess(async (input) => {
      const result =
        await ConsumptionReactionRequestSchema.safeParseAsync(input)

      const parsed = {
        success: result.success,
        data: result.success ? result.data : input,
        error: result.success ? new z.ZodError([]) : result.error,
      }

      const id = Number(c.req.param("id"))
      const reactionId = Number((input as Record<string, unknown>).reaction_id)
      const actualDate = (parsed.data as Record<string, unknown>)
        .actual_date as Date | undefined

      const consumption = await this.repo.findConsumptionById(c, id)
      if (!consumption) {
        parsed.success = false
        parsed.error.issues.push({
          code: z.ZodIssueCode.custom,
          path: ["id"],
          message: "validator.not_exist",
        })
      }

      if (consumption?.actual_transaction_date && actualDate instanceof Date) {
        const txDate = new Date(
          consumption.actual_transaction_date as unknown as string
        )
        const start = new Date(
          txDate.getFullYear(),
          txDate.getMonth(),
          txDate.getDate()
        )
        const provided = new Date(
          actualDate.getFullYear(),
          actualDate.getMonth(),
          actualDate.getDate()
        )
        const end = new Date(start)
        end.setDate(end.getDate() + 30)

        if (provided < start || provided > end) {
          parsed.success = false
          parsed.error.issues.push({
            code: z.ZodIssueCode.custom,
            path: ["actual_date"],
            message: c.var.t("validator.between", {
              field: "actual_date",
              condition: `${moment(start).format("YYYY-MM-DD")} - ${moment(end).format("YYYY-MM-DD")}`,
            }),
          })
        }
      }

      const reaction = await this.repo.findReactionById(c, reactionId)
      if (!reaction) {
        parsed.success = false
        parsed.error.issues.push({
          code: z.ZodIssueCode.custom,
          path: ["reaction_id"],
          message: "validator.not_exist",
        })
      }

      if (!parsed.success) {
        c.set(
          "errors",
          formatErrors(parsed.error, c.var.t, "consumption-reaction")
        )
        throw new ValidationError()
      }

      return input
    }, ConsumptionReactionRequestSchema)
  }
}
