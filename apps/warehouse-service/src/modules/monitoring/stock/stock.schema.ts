import {
  datetimeFormat,
  stringCommaSeparatedNumberArr,
  stringDate,
} from "@/common/schemas/query-param.schema.js"
import { PaginationQueriesSchema } from "@smile/lib/types/paginate.js"
import { z } from "zod"

export const MonitoringStockSchema = PaginationQueriesSchema.extend({
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
  material_level_id: z.string().pipe(z.coerce.number().int()).optional(),
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

export const MonitoringStockSchemaQueryParamsShchema =
  MonitoringStockSchema.extend({
    monitoringStockType: z.number().optional(),
    kfaMaterial: z
      .object({
        columnId: z.string().optional(),
        columnName: z.string().optional(),
        joinTable: z.string().optional(),
        orderBy: z.string().optional(),
      })
      .optional(),
  })

export type MonitoringStockSchemaQueryParams = z.infer<
  typeof MonitoringStockSchemaQueryParamsShchema
>

export interface MonitoringStockDTO {
  master_materials_id?: number
  master_materials_name?: string
  master_materials_code?: string
  master_materials_kfa_code?: string
  master_materials_unit?: string
  min?: number
  max?: number
  month?: string
  year?: string
  exp_month?: string
  exp_year?: string
  qty?: number
  entity_id?: number
  entity_name?: string
  entity_tag_id?: number
  entity_tag_title?: string
  id_satu_sehat?: string
  activity_id?: number
  activity_name?: string
  batches_code?: string
  expired_date?: string
  province_id?: number
  province_name?: string
  regency_id?: number
  regency_name?: string
}

export type RowType = string | number | Date | null
