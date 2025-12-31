import { Context } from "hono"
import z from "zod"

export const validateRequiredFields = <T extends Record<string, any>>(
  c: Context,
  ctx: z.RefinementCtx,
  data: T,
  fields: readonly (keyof T)[],
  translationPrefix: string
) => {
  for (const field of fields) {
    if (!data[field] && data[field] !== 0) {
      ctx.addIssue({
        path: [String(field)],
        message: c.var.t("validator.required", {
          field: c.var.t(`${translationPrefix}.label.${String(field)}`),
        }),
        code: z.ZodIssueCode.custom,
      })
    }
  }
}

export const addValidationIssue = (
  c: Context,
  ctx: z.RefinementCtx,
  field: string,
  translationKey: string,
  translationFieldKey: string,
  params?: Record<string, string>
) => {
  ctx.addIssue({
    path: [field],
    message: c.var.t(translationKey, {
      field: c.var.t(translationFieldKey),
      ...params,
    }),
    code: z.ZodIssueCode.custom,
  })
}
