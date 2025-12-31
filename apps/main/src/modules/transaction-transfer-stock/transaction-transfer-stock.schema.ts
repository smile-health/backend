import z from "zod"

export type MaterialItem = {
  material_id: number
  companion_activity_id: number
  stock_id: number
  qty: number
}

export interface GlobalMaterialDTO {
  material_id_source: number
  material_id_companion: number
  parent_material_id_source: number
  parent_material_id_companion: number
}

export interface GlobalManufactureDTO {
  stock_id: number
  manufacture_id_source: number
  manufacture_id_companion: number
}

export interface GlobalBudgetSourceDTO {
  stock_id: number
  budget_source_id_source: number
  budget_source_id_companion: number
}

export interface StockDetailDTO {
  stock_id: number
  qty: number
  activity_id: number | null
  price: number | null
  batch_code: string | null
  batch_expired_date: Date | null
  batch_production_date: Date | null
  consumption_unit_per_distribution_unit: number | null
}

const SubmitTransferStockAdditionalRequest = z.object({
  global_materials: z
    .array(
      z.object({
        material_id_source: z.number().positive(),
        material_id_companion: z.number().positive(),
        parent_material_id_source: z.number().positive(),
        parent_material_id_companion: z.number().positive(),
      })
    )
    .default([]),
  global_manufactures: z
    .array(
      z.object({
        stock_id: z.number().positive(),
        manufacture_id_source: z.number().positive(),
        manufacture_id_companion: z.number().positive(),
      })
    )
    .default([]),
  global_budget_sources: z
    .array(
      z.object({
        stock_id: z.number().positive(),
        budget_source_id_source: z.number().positive(),
        budget_source_id_companion: z.number().positive(),
      })
    )
    .default([]),
  companion_entity_id: z.number().positive().optional(),
  stocks: z
    .array(
      z.object({
        stock_id: z.number().positive(),
        qty: z.number().nonnegative().default(0),
        activity_id: z.number().positive().nullable().default(null),
        price: z.number().positive().nullable().default(null),
        batch_code: z.string().nullable().default(null),
        batch_production_date: z.date().nullable().default(null),
        batch_expired_date: z.date().nullable().default(null),
        consumption_unit_per_distribution_unit: z
          .number()
          .positive()
          .nullable()
          .default(null),
      })
    )
    .default([]),
})

export const SubmitTransferStockSchema =
  SubmitTransferStockAdditionalRequest.extend({
    entity_id: z.number().positive(),
    companion_program_id: z.number().positive(),
    is_acknowledged: z.boolean().optional(),
    materials: z.array(
      z.object({
        material_id: z.number().positive(),
        companion_activity_id: z.number().positive(),
        stock_id: z.number().positive(),
        qty: z.number().default(0),
      })
    ),
  })

export type SubmitTransferStockRequest = z.infer<
  typeof SubmitTransferStockSchema
>
