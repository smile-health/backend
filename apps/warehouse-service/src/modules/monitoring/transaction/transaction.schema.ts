import {
  datetimeFormat,
  stringCommaSeparatedNumberArr,
  stringDate,
} from "@/common/schemas/query-param.schema.js"
import { PaginationQueriesSchema } from "@smile-health/lib/types/paginate.js"
import { z } from "zod"

export const MonitoringTransactionSchema = PaginationQueriesSchema.extend({
  from: stringDate("YYYY-MM-DD 00:00:00"),
  to: stringDate("YYYY-MM-DD 23:59:59"),
  activity_ids: stringCommaSeparatedNumberArr("activity_ids"),
  material_ids: stringCommaSeparatedNumberArr("material_ids"),
  start_expired_date: datetimeFormat("start_expired_date").optional(),
  end_expired_date: datetimeFormat("end_expired_date").optional(),
  province_id: z.string().pipe(z.coerce.number().int()).optional(),
  regency_id: z.string().pipe(z.coerce.number().int()).optional(),
  entity_id: z.string().pipe(z.coerce.number().int()).optional(),
  entity_tag_ids: stringCommaSeparatedNumberArr("entity_tag_ids").optional(),
  material_type_ids: stringCommaSeparatedNumberArr("material_type").optional(),
  transaction_type: z.string().pipe(z.coerce.number().int()).optional(),
  information_type: z
    .string()
    .nonempty("informationType is required")
    .refine((val) => !isNaN(Number(val)), {
      message: "informationType must be a number",
    })
    .refine((val) => ["0", "1"].includes(val), {
      message: "informationType must be 0 or 1",
    })
    .transform((val) => Number(val)),
  material_level_id: z.string().pipe(z.coerce.number().int()),
  sort_by_id: z
    .string()
    .refine((val) => !val || ["0", "1"].includes(val), {
      message: "Sort By Count must be 0 or 1",
    })
    .transform((val) => Number(val))
    .optional(),
  sort_by_count: z
    .string()
    .refine((val) => !val || ["0", "1"].includes(val), {
      message: "Sort By Count must be 0 or 1",
    })
    .transform((val) => Number(val))
    .optional(),
  sort_by_area: z
    .string()
    .refine((val) => !val || ["0", "1"].includes(val), {
      message: "Sort By Area must be 0 or 1",
    })
    .transform((val) => Number(val))
    .optional(),
  sort_by_name: z
    .string()
    .refine((val) => !val || ["0", "1"].includes(val), {
      message: "Sort By Name must be 0 or 1",
    })
    .transform((val) => Number(val))
    .optional(),
  sort: z
    .string()
    .refine((val) => !val || ["0", "1"].includes(val), {
      message: "Sort must be 0 or 1",
    })
    .transform((val) => Number(val))
    .optional(),
})

export const MonitoringTransactionSchemaQueryParamsSchema =
  MonitoringTransactionSchema.extend({
    monitoringTransactionType: z.number().optional(),
    transactionQuery: z
      .object({
        column: z.array(z.string()).optional(),
        orderBy: z.string().optional(),
        transaction_type_title: z.string().optional(),
        joinTable: z.string().optional(),
        columnJoinTable: z.string().optional(),
        groupBy: z.string().optional(),
      })
      .optional(),
  })

export type MonitoringTransactionSchemaQueryParams = z.infer<
  typeof MonitoringTransactionSchemaQueryParamsSchema
>

export interface MonitoringTransactionDTO {
  year: string
  month: string
  entity_id?: number
  entity_name?: string
  material_id?: number
  material_name?: string
  material_unit?: string
  material_parent_name?: string
  batch_code?: string
  batch_id?: number
  expired_date?: string
  manufacture_id?: number
  manufacture_name?: string
  vendor_id?: number
  vendor_name?: string
  activity_name?: string
  customer_id?: number
  customer_name?: string
  customer_province_id?: number
  customer_province_name?: string
  customer_regency_id?: number
  customer_regency_name?: string
  entity_tag_id?: number
  entity_tag_title?: string
  province_id?: number
  province_name?: string
  regency_id?: number
  regency_name?: string
  transaction_type_id?: number
  transaction_type_name?: string
  transaction_reason_id?: number
  transaction_reason_name?: string
  reason_id?: number
  reason_name?: string
  value?: number
  value_consumption?: number
  value_acceptance?: number
  value_distribution?: number
  value_returning?: number
  value_discarding?: number
  value_acceptance_returning?: number
  count?: number
  count_consumption?: number
  count_acceptance?: number
  count_distribution?: number
  count_returning?: number
  count_discarding?: number
  count_acceptance_returning?: number
  created_at?: string
}

export interface MonitoringTransactionChartCategoriesDTO {
  id: string
  label: string
  selector?: string
}

export interface MonitoringTransactionChartDatasetDTO {
  label: string
  color: string
  dotted_line: boolean
  data: number[]
}

export interface MonitoringTransactionChartDTO {
  number?: number
  by_entity_tag?: {
    categories: MonitoringTransactionChartCategoriesDTO[]
    dataset: MonitoringTransactionChartDatasetDTO[]
  }
  by_month?: {
    categories: MonitoringTransactionChartCategoriesDTO[]
    dataset: MonitoringTransactionChartDatasetDTO[]
  }
}

export interface MonitoringTransactionChartOldDTO {
  number?: number
  entity_tag?: {
    entity_tag_id?: number
    entity_tag_title?: string | null
    value?: number
  }[]
  by_month?: {
    year?: number
    month?: string
    value?: number
  }[]
}

export interface MonitoringTransactionBigNumberDTO {
  date: string
  data: number
}
