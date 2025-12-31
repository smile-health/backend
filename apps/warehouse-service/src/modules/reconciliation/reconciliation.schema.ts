import {
  QueryParamsSchema,
  stringDate,
} from "@/common/schemas/query-param.schema.js"
import { IdSchema } from "@smile/lib/types/param.js"
import moment from "moment"
import { z } from "zod"

/* Schemas */
export const ReconciliationQueryParamsSchema = z.intersection(
  QueryParamsSchema,
  z.object({
    start_date: stringDate("YYYY-MM-DD 00:00:00")
      .nullish()
      .default(moment().format("YYYY-MM-DD 00:00:00")),
    end_date: stringDate("YYYY-MM-DD 23:59:59")
      .nullish()
      .default(moment().format("YYYY-MM-DD 23:59:59")),
  })
)

export const ReconciliationEntityReportItemDTOSchema = z.object({
  entity_id: IdSchema,
  entity_name: z.string(),
  month: z.number().int(),
  year: z.number().int(),
  value: z.number().nonnegative(),
})

export const ReconciliationEntityReportDTOSchema = z.array(
  ReconciliationEntityReportItemDTOSchema
)

export const ReconciliationEntityReportResponseDataSchema = z.array(
  z.object({
    id: IdSchema,
    name: z.string(),
    total: z.number().nonnegative(),
    average: z.number().nonnegative(),
    months: z.record(z.string(), z.number().nonnegative()),
  })
)

export const ReconciliationEntityReportResponseSchema = z.object({
  page: z.number().positive(),
  item_per_page: z.number().positive(),
  total_item: z.number().nonnegative(),
  total_page: z.number().nonnegative(),
  list_pagination: z.array(z.number().positive()),
  data: ReconciliationEntityReportResponseDataSchema,
})

export const ReconciliationBarReportItemDTOSchema = z.object({
  month: z.number().int(),
  year: z.number().int(),
  value: z.number().nonnegative(),
})

export const ReconciliationBarReportDTOSchema = z.array(
  ReconciliationBarReportItemDTOSchema
)

export const ReconciliationBarReportResponseSchema = z.object({
  intervalPeriod: z.array(z.string()),
  data: z.array(
    z.object({
      label: z.string(),
      value: z.number().nonnegative(),
    })
  ),
  column: z.array(
    z.object({
      label: z.string(),
    })
  ),
  subColumn: z.array(z.string()),
})

/* Types */
export type ReconciliationQueryParams = z.infer<
  typeof ReconciliationQueryParamsSchema
>

export type ReconciliationEntityReportItemDTO = z.infer<
  typeof ReconciliationEntityReportItemDTOSchema
>
export type ReconciliationEntityReportDTO = z.infer<
  typeof ReconciliationEntityReportDTOSchema
>

export type ReconciliationEntityReportResponse = z.infer<
  typeof ReconciliationEntityReportResponseSchema
>

export type ReconciliationBarReportItemDTO = z.infer<
  typeof ReconciliationBarReportItemDTOSchema
>
export type ReconciliationBarReportDTO = z.infer<
  typeof ReconciliationBarReportDTOSchema
>

export type ReconciliationBarReportResponse = z.infer<
  typeof ReconciliationBarReportResponseSchema
>
