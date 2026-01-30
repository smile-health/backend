import { PaginationQueriesSchema } from "@smile-health/lib/types/paginate.js"
import { IdSchema, IdsSchema } from "@smile-health/lib/types/param.js"
import moment from "moment"
import { z } from "zod"

export const stringDate = (format?: string) =>
  z.preprocess(
    (arg) => {
      if (typeof arg === "string" || arg instanceof Date) {
        const date = new Date(arg)
        return isNaN(date.getTime())
          ? undefined
          : moment(date).format(format ?? `YYYY-MM-DD HH:mm:ss`)
      }
      return undefined
    },
    z.string().refine(
      (v) => {
        if (!v) return true
        return moment(v).isValid()
      },
      { message: "validator.date" }
    )
  )

export const datetimeFormat = (label: string) =>
  z
    .string()
    .refine((val) => moment(val, "YYYY-MM-DD HH:mm:ss", true).isValid(), {
      message: `${label} is not a valid datetime`,
    })

export const stringCommaSeparatedNumberArr = (label: string) =>
  z.coerce
    .string()
    .nonempty({ message: `${label} cannot be empty` })
    .optional()
    .refine(
      (val) => {
        if (val) {
          val
            .split(",")
            .filter((item) => item.trim() !== "")
            .every((num) => !isNaN(Number(num)))
        }
        return true
      },
      {
        message: `Invalid ${label}`,
      }
    )
    .transform((val) => {
      if (val) {
        return val
          .split(",")
          .filter((item) => item.trim() !== "")
          .map((num) => Number(num))
      }
    })

// DEPRECATED, Need to be merge with QueryParamsSChema
export const QueryParamSchema = PaginationQueriesSchema.extend({
  from: stringDate("YYYY-MM-DD 00:00:00"),
  to: stringDate("YYYY-MM-DD 23:59:59"),
  activity_ids: stringCommaSeparatedNumberArr("activity_ids"),
  material_ids: stringCommaSeparatedNumberArr("material_ids"),
  start_expired_date: datetimeFormat("start_expired_date").optional(),
  end_expired_date: datetimeFormat("end_expired_date").optional(),
  province_id: z.string().pipe(z.coerce.number().int()).optional(),
  regency_id: z.string().pipe(z.coerce.number().int()).optional(),
  subdistrict_id: z.string().pipe(z.coerce.number().int()).optional(),
  entity_id: z.string().pipe(z.coerce.number().int()).optional(),
  customer_id: z.string().pipe(z.coerce.number().int()).optional(),
  customer_entity_tag_id: z.string().pipe(z.coerce.number().int()).optional(),
  entity_tag_ids: stringCommaSeparatedNumberArr("entity_tag_ids").optional(),
  material_type_ids: stringCommaSeparatedNumberArr("material_type").optional(),
  transaction_type: z.string().pipe(z.coerce.number().int()).optional(),
  material_level_id: z.string().pipe(z.coerce.number().int()).optional(),
  sort_by_id: z
    .string()
    .optional()
    .refine((val) => !val || ["0", "1"].includes(val), {
      message: "Sort By Count must be 0 or 1",
    })
    .transform((val) => Number(val)),
  sort_by_count: z
    .string()
    .optional()
    .refine((val) => !val || ["0", "1"].includes(val), {
      message: "Sort By Count must be 0 or 1",
    })
    .transform((val) => Number(val)),
  sort_by_area: z
    .string()
    .optional()
    .refine((val) => !val || ["0", "1"].includes(val), {
      message: "Sort By Area must be 0 or 1",
    })
    .transform((val) => Number(val)),
  sort_by_name: z
    .string()
    .optional()
    .refine((val) => !val || ["0", "1"].includes(val), {
      message: "Sort By Name must be 0 or 1",
    })
    .transform((val) => Number(val)),
  sort: z
    .string()
    .optional()
    .refine((val) => !val || ["0", "1"].includes(val), {
      message: "Sort must be 0 or 1",
    })
    .transform((val) => Number(val)),
})

export const QueryParamsSchema = z
  .object({
    // from: DateSchema.nullish().default(moment().format("YYYY-MM-DD 00:00:00")),
    // to: DateSchema.nullish().default(moment().format("YYYY-MM-DD 23:59:59")),
    from: stringDate("YYYY-MM-DD 00:00:00")
      .nullish()
      .default(moment().format("YYYY-MM-DD 00:00:00")),
    to: stringDate("YYYY-MM-DD 23:59:59")
      .nullish()
      .default(moment().format("YYYY-MM-DD 23:59:59")),
    activity_id: IdSchema.nullish(),
    activity_ids: IdsSchema.nullish(),
    material_id: IdSchema.nullish(),
    material_ids: IdsSchema.nullish(),
    material_type_id: IdSchema.nullish(),
    material_type_ids: IdsSchema.nullish(),
    batch_id: IdSchema.nullish(),
    batch_code: z.string().nullish(),
    entity_tag_id: IdSchema.nullish(),
    entity_tag_ids: IdsSchema.nullish(),
    entity_type_id: IdSchema.nullish(),
    entity_type_ids: IdsSchema.nullish(),
    province_id: IdSchema.nullish(),
    province_ids: IdsSchema.nullish(),
    regency_id: IdSchema.nullish(),
    regency_ids: IdsSchema.nullish(),
    entity_id: IdSchema.nullish(),
    entity_ids: IdsSchema.nullish(),
    start_expired_date: stringDate("YYYY-MM-DD 00:00:00").nullish(),
    end_expired_date: stringDate("YYYY-MM-DD 23:59:59").nullish(),
    material_level_id: IdSchema.nullish().default("3"),
    page: z.coerce.number().int().min(1).default(1),
    paginate: z.coerce.number().int().min(10).default(10),
    program_id: z.number().nullish(),
  })
  .transform((queryParams) => ({
    ...queryParams,
    offset: (queryParams.page - 1) * queryParams.paginate,
  }))

export type QueryParams = z.infer<typeof QueryParamsSchema>

export const UsedForSchema = z
  .enum(["review", "location", "entity", "material"])
  .default("review")

export type UsedFor = z.infer<typeof UsedForSchema>
