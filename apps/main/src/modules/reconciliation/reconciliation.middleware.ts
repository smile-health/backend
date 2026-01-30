import { ValidationError } from "@smile-health/lib/error.js"
import { formatErrors } from "@smile-health/lib/zod.js"
import { Context } from "hono"
import z from "zod"
import { MaterialRepository } from "../material/material.repository.js"
import { ReconciliationRepository } from "./reconciliation.repository.js"
import {
  CreateReconciliationDTO,
  CreateReconciliationSchema,
  GetGenerateReconciliationSchema,
} from "./reconciliation.schema.js"

export class ReconciliationMiddleware {
  constructor(
    private readonly repo: ReconciliationRepository,
    private readonly materialRepo: MaterialRepository
  ) {}

  readonly #isMaterialExist = async (
    c: Context,
    material_id: number | undefined
  ) => {
    if (material_id === undefined) return false
    const result = await this.materialRepo.find(c, { id: material_id })

    return Array.isArray(result) ? result.length > 0 : !!result
  }

  readonly #isReconciliationCategoryExist = async (
    c: Context,
    category_id: number | undefined
  ) => {
    if (category_id === undefined) return false
    return !!(await this.repo.findReconciliationCategoryById(c, category_id))
  }

  readonly #isReasonExist = async (
    c: Context,
    reason_id: number | undefined
  ) => {
    if (reason_id === undefined) return false
    return !!(await this.repo.findReasonById(c, reason_id))
  }

  readonly #isActionExist = async (
    c: Context,
    action_id: number | undefined
  ) => {
    if (action_id === undefined) return false
    return !!(await this.repo.findActionById(c, action_id))
  }

  readonly #hasDuplicateReasonAction = (
    reasons: { id: number }[],
    actions: { id: number }[]
  ) => {
    const reasonActionPairs = new Set<string>()

    // Take the minimum length to avoid out-of-bounds errors
    const minLength = Math.min(reasons.length, actions.length)

    for (let i = 0; i < minLength; i++) {
      const reasonId = reasons[i]?.id ?? 0
      const actionId = actions[i]?.id ?? 0
      const pairKey = `${reasonId}-${actionId}`

      if (reasonActionPairs.has(pairKey)) {
        return true
      }
      reasonActionPairs.add(pairKey)
    }

    return false
  }

  readonly #isEndDateGreaterThanStartDate = (
    start_date: string,
    end_date: string
  ) => {
    const startDate = new Date(start_date)
    const endDate = new Date(end_date)
    return endDate >= startDate
  }

  create = (c: Context) => {
    return z.preprocess(async (input) => {
      const result = await CreateReconciliationSchema.safeParseAsync(input)

      const parsed = {
        success: result.success,
        data: result.success ? result.data : input,
        error: result.success ? new z.ZodError([]) : result.error,
      }

      const typedInput = input as CreateReconciliationDTO
      const material_id = typedInput.material_id
      const start_date = typedInput.start_date
      const end_date = typedInput.end_date
      const items = typedInput.items || []

      const materialExists = await this.#isMaterialExist(c, material_id)
      if (!materialExists) {
        parsed.success = false
        parsed.error.issues.push({
          code: z.ZodIssueCode.custom,
          path: ["material_id"],
          message: c.var.t("validator.not_exist", {
            field: c.var.t("reconciliation.label.material_id"),
          }),
        })
      }

      if (
        start_date &&
        end_date &&
        !this.#isEndDateGreaterThanStartDate(start_date, end_date)
      ) {
        parsed.success = false
        parsed.error.issues.push({
          code: z.ZodIssueCode.custom,
          path: ["end_date"],
          message: "validator.end_date_before_start_date",
        })
      }

      for (let i = 0; i < items.length; i++) {
        const item = items[i]

        const categoryExists = await this.#isReconciliationCategoryExist(
          c,
          item?.reconciliation_category
        )
        if (!categoryExists) {
          parsed.success = false
          parsed.error.issues.push({
            code: z.ZodIssueCode.custom,
            path: ["items", `${i}`, "reconciliation_category"],
            message: c.var.t("validator.not_exist", {
              field: c.var.t("reconciliation.label.reconciliation_category"),
            }),
          })
        }

        if (item?.reasons) {
          for (let j = 0; j < item.reasons.length; j++) {
            const reasonId = Number(item.reasons?.[j]?.id)
            const reasonExists = await this.#isReasonExist(c, reasonId)
            if (!reasonExists) {
              parsed.success = false
              parsed.error.issues.push({
                code: z.ZodIssueCode.custom,
                path: ["items", `${i}`, "reasons"],
                message: c.var.t("validator.not_exist", {
                  field: c.var.t("reconciliation.label.reason"),
                }),
              })
            }
          }
        }

        if (item?.actions) {
          for (let j = 0; j < item.actions.length; j++) {
            const actionId = Number(item.actions?.[j]?.id)
            const actionExists = await this.#isActionExist(c, actionId)
            if (!actionExists) {
              parsed.success = false
              parsed.error.issues.push({
                code: z.ZodIssueCode.custom,
                path: ["items", `${i}`, "actions"],
                message: c.var.t("validator.not_exist", {
                  field: c.var.t("reconciliation.label.action"),
                }),
              })
            }
          }
        }

        if (
          item?.reasons &&
          item?.actions &&
          this.#hasDuplicateReasonAction(item.reasons, item.actions)
        ) {
          parsed.success = false
          parsed.error.issues.push({
            code: z.ZodIssueCode.custom,
            path: ["items", `${i}`, "reasons"],
            message: c.var.t("validator.duplicated", {
              field:
                c.var.t("reconciliation.label.reason") +
                "-" +
                c.var.t("reconciliation.label.action"),
            }),
          })
        }
      }

      if (!parsed.success) {
        c.set("errors", formatErrors(parsed.error, c.var.t, "reconciliation"))
        throw new ValidationError()
      }

      return input
    }, CreateReconciliationSchema)
  }

  generate = (c: Context) => {
    return z.preprocess(async (input) => {
      const result = await GetGenerateReconciliationSchema.safeParseAsync(input)

      const parsed = {
        success: result.success,
        data: result.success ? result.data : input,
        error: result.success ? new z.ZodError([]) : result.error,
      }

      const typedInput = input as CreateReconciliationDTO
      const material_id = typedInput.material_id
      const start_date = typedInput.start_date
      const end_date = typedInput.end_date

      const materialExists = await this.#isMaterialExist(c, material_id)
      if (!materialExists) {
        parsed.success = false
        parsed.error.issues.push({
          code: z.ZodIssueCode.custom,
          path: ["material_id"],
          message: c.var.t("validator.not_exist", {
            field: c.var.t("reconciliation.label.material_id"),
          }),
        })
      }

      if (
        start_date &&
        end_date &&
        !this.#isEndDateGreaterThanStartDate(start_date, end_date)
      ) {
        parsed.success = false
        parsed.error.issues.push({
          code: z.ZodIssueCode.custom,
          path: ["end_date"],
          message: "validator.end_date_before_start_date",
        })
      }

      if (!parsed.success) {
        c.set("errors", formatErrors(parsed.error, c.var.t, "reconciliation"))
        throw new ValidationError()
      }

      return input
    }, GetGenerateReconciliationSchema)
  }
}
