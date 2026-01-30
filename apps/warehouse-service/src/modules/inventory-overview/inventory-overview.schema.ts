import { QueryParamsSchema } from "@/common/schemas/query-param.schema.js"
import { IdSchema } from "@smile-health/lib/types/param.js"
import { z } from "zod"

export const InventoryOverviewQueryParamsSchema = z.intersection(
  QueryParamsSchema,
  z.object({
    material_type_id: IdSchema.optional(),
  })
)

export const TemperatureOverviewQueryParamsSchema = z.intersection(
  QueryParamsSchema,
  z.object({
    material_type_id: IdSchema.optional(),
    working_status_id: IdSchema.optional(),
  })
)

export const StockMaterialQueryParamsSchema = z.intersection(
  InventoryOverviewQueryParamsSchema,
  z.object({
    transaction_type: z.enum(["normal", "min", "max", "zero_stock"]),
  })
)

export const MaterialEntityQueryParamsSchema = z.intersection(
  InventoryOverviewQueryParamsSchema,
  z.object({
    material_id: IdSchema,
    transaction_type: z.enum(["normal", "min", "max", "zero_stock"]),
  })
)

export type InventoryOverviewQueryParams = z.infer<
  typeof InventoryOverviewQueryParamsSchema
>

export type TemperatureOverviewQueryParams = z.infer<
  typeof TemperatureOverviewQueryParamsSchema
>

export type StockMaterialQueryParams = z.infer<
  typeof StockMaterialQueryParamsSchema
>

export type MaterialEntityQueryParams = z.infer<
  typeof MaterialEntityQueryParamsSchema
>

export const InventoryDataSchema = z.object({
  transactions_id: z.number(),
  transactions_master_material_id: z.number().nullable(),
  transactions_master_material_name: z.string().nullable(),
  transactions_activity_id: z.number().nullable(),
  location_id: z.number().nullable(),
  entities_id: z.number().nullable(),
  entities_province_id: z.number().nullable(),
  entities_regency_id: z.number().nullable(),
  entities_name: z.string().nullable(),
  entities_province_name: z.string().nullable(),
  entities_regency_name: z.string().nullable(),
  transactions_round_balance_qty: z.number().nullable(),
  status: z.string(),
  transactions_createdAt_as_date: z.string(),
})

export type InventoryDataDTO = z.infer<typeof InventoryDataSchema>

export const LastUpdatedSchema = z.object({
  last_update: z.string(),
})

export type LastUpdatedDTO = z.infer<typeof LastUpdatedSchema>

export const StockDataItemSchema = z.object({
  label: z.string(),
  type: z.string(),
  is_selected: z.boolean(),
  value: z.number(),
  totals: z.number(),
  percent: z.number(),
  tooltip: z.string(),
})

export const StockOverviewResponseSchema = z.object({
  current_time: z.string(),
  last_updated: z.string(),
  map_name: z.string(),
  province: z
    .object({
      id: z.number(),
      name: z.string(),
    })
    .optional(),
  regency: z
    .object({
      id: z.number(),
      name: z.string(),
    })
    .optional(),
  data: z.array(StockDataItemSchema),
})

export type StockOverviewResponse = z.infer<typeof StockOverviewResponseSchema>

export const LocationDataItemSchema = z.object({
  id: z.number(),
  name: z.string(),
  value: z.number(),
  percent: z.number(),
  tooltip: z.string(),
})

export const StockLocationResponseSchema = z.object({
  data: z.object({
    normal: z.array(LocationDataItemSchema),
    min: z.array(LocationDataItemSchema),
    max: z.array(LocationDataItemSchema),
    zero_stock: z.array(LocationDataItemSchema),
  }),
})

export type StockLocationResponse = z.infer<typeof StockLocationResponseSchema>

export const ActivityDataItemSchema = z.object({
  name: z.string(),
  type: z.string(),
  value: z.number(),
  percent: z.number(),
  tooltip: z.string(),
})

export const ActivityOverviewResponseSchema = z.object({
  last_updated: z.string(),
  axis_name: z.string(),
  map_name: z.string(),
  province: z
    .object({
      id: z.number(),
      name: z.string(),
    })
    .optional(),
  regency: z
    .object({
      id: z.number(),
      name: z.string(),
    })
    .optional(),
  data: z.array(ActivityDataItemSchema),
})

export type ActivityOverviewResponse = z.infer<
  typeof ActivityOverviewResponseSchema
>

export const ActivityLocationResponseSchema = z.object({
  data: z.object({
    active: z.array(LocationDataItemSchema),
    inactive: z.array(LocationDataItemSchema),
  }),
})

export type ActivityLocationResponse = z.infer<
  typeof ActivityLocationResponseSchema
>

export type EntityActivityDTO = {
  entityId: number
  entityType: number
  entityProvinceId: number
  entityRegencyId: number
}

export const MaterialEntityItemSchema = z.object({
  id: z.number().nullable(),
  name: z.string().nullable(),
  value: z.number().nullable(),
  province: z.object({
    id: z.number().nullable(),
    name: z.string().nullable(),
  }),
  regency: z.object({
    id: z.number().nullable(),
    name: z.string().nullable(),
  }),
})

export const MaterialDataItemSchema = z.object({
  id: z.number(),
  name: z.string(),
  value: z.number(),
  tooltip: z.string(),
  entities: z.array(MaterialEntityItemSchema),
})

export const MaterialDataItemWithoutEntitiesSchema = z.object({
  id: z.number(),
  name: z.string(),
  value: z.number(),
  tooltip: z.string(),
})

export const StockMaterialResponseSchema = z.object({
  data: z.array(MaterialDataItemWithoutEntitiesSchema),
})

export type StockMaterialResponse = z.infer<typeof StockMaterialResponseSchema>

export const MaterialEntityResponseSchema = z.object({
  data: z.array(MaterialEntityItemSchema),
})

export type MaterialEntityResponse = z.infer<
  typeof MaterialEntityResponseSchema
>

export const TemperatureDataSchema = z.object({
  asset_rtmd_id: z.number().nullable(),
  temperature: z.number().nullable(),
  excursion_type: z.string().nullable(),
  province_id: z.string().nullable(),
  regency_id: z.string().nullable(),
  sub_district_id: z.string().nullable(),
  entity_id: z.number().nullable(),
  location_id: z.number().nullable(),
})

export type TemperatureDataDTO = z.infer<typeof TemperatureDataSchema>

export const TemperatureOverviewAggregatedSchema = z.object({
  latest_status_excursion: z.string(),
  inventory_count: z.number(),
})

export type TemperatureOverviewAggregatedDTO = z.infer<
  typeof TemperatureOverviewAggregatedSchema
>

export const TemperatureLocationAggregatedSchema = z.object({
  location_id: z.number(),
  latest_status_excursion: z.string(),
  inventory_count: z.number(),
})

export type TemperatureLocationAggregatedDTO = z.infer<
  typeof TemperatureLocationAggregatedSchema
>

export const TemperatureDataItemSchema = z.object({
  label: z.string(),
  type: z.string(),
  is_selected: z.boolean(),
  value: z.number(),
  totals: z.number(),
  percent: z.number(),
  tooltip: z.string(),
})

export const TemperatureOverviewResponseSchema = z.object({
  current_time: z.string(),
  last_updated: z.string(),
  map_name: z.string(),
  province: z
    .object({
      id: z.number(),
      name: z.string(),
    })
    .optional(),
  regency: z
    .object({
      id: z.number(),
      name: z.string(),
    })
    .optional(),
  data: z.array(TemperatureDataItemSchema),
})

export type TemperatureOverviewResponse = z.infer<
  typeof TemperatureOverviewResponseSchema
>

export const TemperatureLocationResponseSchema = z.object({
  data: z.object({
    normal: z.array(LocationDataItemSchema),
    low: z.array(LocationDataItemSchema),
    high: z.array(LocationDataItemSchema),
    unknown: z.array(LocationDataItemSchema),
  }),
})

export type TemperatureLocationResponse = z.infer<
  typeof TemperatureLocationResponseSchema
>
