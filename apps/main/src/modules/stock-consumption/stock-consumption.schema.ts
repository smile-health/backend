import { PaginationQueriesSchema } from "@smile-health/lib/types/paginate.js"
import z from "zod"

export type ListStockConsumptionDTO = {
  entity_id: number | null
  entity_name: string | null
  entity_type: number | null
  entity_address: string | null
  entity_tag: string | null
  location: string
  material_id: number
  material_name: string
  is_temperature_sensitive: number
  is_open_vial: number | null
  is_managed_in_batch: number
  unit_of_consumption: string
  consumption_unit_per_distribution_unit: number
  activity_id: number
  activity_name: string
  stock_activity_id: number
  stock_activity_name: string
  stock_id: number
  stock_qty: number
  stock_updated_at: Date
  batch_id: number | null
  batch_code: string | null
  batch_production_date: Date | null
  batch_expired_date: Date | null
  manufacture_id: number | null
  manufacture_name: string | null
  manufacture_address: string | null
}

export type DetailStockConsumptionDTO = {
  material_id: number
  material_name: string
  is_temperature_sensitive: number
  is_open_vial: number | null
  is_managed_in_batch: number
  unit_of_consumption: string
  consumption_unit_per_distribution_unit: number
  stock_activity_id: number
  stock_activity_name: string
  stock_id: number
  stock_qty: number
  stock_updated_at: Date
  batch_id: number | null
  batch_code: string | null
  batch_production_date: Date | null
  batch_expired_date: Date | null
  manufacture_id: number | null
  manufacture_name: string | null
  manufacture_address: string | null
}

export type ListStockConsumptionResponse = {
  total_qty: number
  updated_at: string
  material: {
    id: number
    name: string
    is_temperature_sensitive: number
    is_open_vial: number | null
    is_managed_in_batch: number
    unit_of_consumption: string
    consumption_unit_per_distribution_unit: number
  }
  entity: {
    id: number | null
    name: string | null
    type: number | null
    address: string | null
    tag: string | null
    location: string
  }
  details: {
    activity: {
      id: number
      name: string
    }
    material: {
      id: number
      name: string
      is_temperature_sensitive: number
      is_open_vial: number | null
      is_managed_in_batch: number
      unit_of_consumption: string
      consumption_unit_per_distribution_unit: number
    }
    total_qty: number
    updated_at: string
    stock_consumptions: {
      id: number
      batch: {
        id: number
        code: string | null
        production_date: string | null
        expired_date: string | null
        manufacture: {
          id: number
          name: string | null
          address: string | null
        } | null
      } | null
      qty: number
      updated_at: string
      activity: {
        id: number
        name: string
      }
    }[]
  }[]
}

export type DetailStockConsumptionResponse = {
  activity: {
    id: number
    name: string
  }
  material: {
    id: number
    name: string
    is_temperature_sensitive: number
    is_open_vial: number | null
    is_managed_in_batch: number
    unit_of_consumption: string
    consumption_unit_per_distribution_unit: number
  }
  total_qty: number
  updated_at: string
  stock_consumptions: {
    id: number
    batch: {
      id: number
      code: string | null
      production_date: string | null
      expired_date: string | null
      manufacture: {
        id: number
        name: string | null
        address: string | null
      } | null
    } | null
    qty: number
    updated_at: string
    activity: {
      id: number
      name: string
    }
  }[]
}

export const GetListStockConsumptionSchema = PaginationQueriesSchema.extend({
  activity_id: z
    .string()
    .transform((v) => Number(v))
    .refine((v) => !isNaN(v), {
      message: "INVALID PARAM activity_id",
    })
    .optional(),
  vendor_id: z
    .string()
    .transform((v) => Number(v))
    .refine((v) => !isNaN(v), {
      message: "INVALID PARAM vendor_id",
    })
    .optional(),
  customer_id: z
    .string()
    .transform((v) => Number(v))
    .refine((v) => !isNaN(v), {
      message: "INVALID PARAM customer_id",
    })
    .optional(),
})

export const GetDetailStockConsumptionSchema = z.object({
  material_id: z
    .string()
    .transform((v) => Number(v))
    .refine((v) => !isNaN(v), {
      message: "INVALID PARAM material_id",
    }),
  vendor_id: z
    .string()
    .transform((v) => Number(v))
    .refine((v) => !isNaN(v), {
      message: "INVALID PARAM vendor_id",
    }),
  customer_id: z
    .string()
    .transform((v) => Number(v))
    .refine((v) => !isNaN(v), {
      message: "INVALID PARAM customer_id",
    }),
})

export type GetListStockConsumptionQueries = z.infer<
  typeof GetListStockConsumptionSchema
>
export type GetDetailStockConsumptionQueries = z.infer<
  typeof GetDetailStockConsumptionSchema
>
