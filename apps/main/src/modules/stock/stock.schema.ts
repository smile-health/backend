import {
  WsEntityMaterialActivities,
  WsStocks,
} from "@/common/infrastructure/database/types/db.js"
import { PaginationQueriesSchema } from "@smile/lib/types/paginate.js"
import {
  IdSchema,
  OptionalIdSchema,
  OptionalIdsSchema,
} from "@smile/lib/types/param.js"
import { Insertable, Selectable, Updateable } from "kysely"
import moment from "moment"
import z from "zod"

// TODO: move this to shared package
const dateSchema = z
  .string()
  .refine(
    (v) => {
      if (!v) return true
      return moment(v).isValid()
    },
    { message: "validator.date" }
  )
  .transform((val) => moment(val).format("YYYY-MM-DD HH:mm:ss"))
  .nullish()

export const GetStocksQueriesSchema = PaginationQueriesSchema.extend({
  entity_id: OptionalIdSchema.nullish(),
  material_id: OptionalIdsSchema.nullish(),
  material_level_id: OptionalIdSchema.nullish(),
  material_type_id: OptionalIdSchema.nullish(),
  activity_id: OptionalIdSchema.nullish(),
  only_have_qty: z.enum(["0", "1"]).default("0").transform(Number).nullish(),
  with_details: z.enum(["0", "1"]).default("0").transform(Number).nullish(),
  entity_tag_id: OptionalIdSchema.nullish(),
  province_id: OptionalIdSchema.nullish(),
  regency_id: OptionalIdSchema.nullish(),
  expired_start_date: dateSchema.nullish(),
  expired_end_date: dateSchema.nullish(),
  batch_ids: OptionalIdsSchema.nullish(),
  period_id: OptionalIdSchema.nullish(),
})

export const GetStockDetailsQueriesSchema = z
  .object({
    entity_id: IdSchema,
    material_id: IdSchema.nullish(),
    parent_material_id: IdSchema.nullish(),
    activity_id: OptionalIdSchema.nullish(),
    group_by: z.enum(["material", "activity", "activity_material"]),
    expired_start_date: dateSchema,
    expired_end_date: dateSchema,
    batch_ids: OptionalIdsSchema.nullish(),
    stock_ids: OptionalIdsSchema.nullish(),
    material_ids: OptionalIdsSchema.nullish(),
    period_id: OptionalIdSchema.nullish(),
    only_have_qty: z.enum(["0", "1"]).default("0").transform(Number).nullish(),
  })
  .refine((data) => data.material_id || data.parent_material_id, {
    message: "Either material_id or parent_material_id must be provided",
    path: ["material_id"],
  })

export const GetListEntityStockSchema = z.object({
  entity_ids: z
    .string()
    .refine(
      (val) =>
        val
          .split(",")
          .filter((item) => item !== "")
          .every((num) => !isNaN(Number(num))),
      {
        message: "INVALID_ENTITY_ID_PARAM",
      }
    )
    .transform((val) =>
      val
        .split(",")
        .filter((item) => item !== "")
        .map((str) => Number(str))
    )
    .optional(),
})

export const GetEntityStocksQueriesSchema = PaginationQueriesSchema.extend({
  entity_id: IdSchema,
  material_id: OptionalIdsSchema.nullish(),
  activity_id: OptionalIdSchema.transform((v) =>
    isNaN(v) ? undefined : Number(v)
  ),
  only_have_qty: z.enum(["0", "1"]).default("0").transform(Number),
  with_details: z.enum(["0", "1"]).default("0").transform(Number).nullish(),
  material_level_id: IdSchema.default("3").transform(Number),
  period_id: OptionalIdSchema.nullish(),
  is_addremove: z.enum(["0", "1"]).default("0").transform(Number).nullish(),
})

export type GetStocksQueries = z.infer<typeof GetStocksQueriesSchema> & {
  program_id?: number
}
export type GetStockDetailsQueries = z.infer<
  typeof GetStockDetailsQueriesSchema
>
export type GetEntityStocksQueries = z.infer<
  typeof GetEntityStocksQueriesSchema
>
export type GetListEntityStockQueries = z.infer<typeof GetListEntityStockSchema>

export type CreateStockDTO = Insertable<WsStocks>
export type StockDTO = Selectable<WsStocks>
export type UpsertEntityMaterialDTO = Updateable<WsEntityMaterialActivities> & {
  program_id: number
  is_hierarchy: number
}

export type stockNotif = {
  activity_id: number
  entity_id: number
  id: number
  material_id: number
  max: number | null
  min: number | null
  program_id: number | null
  material_name: string | null
  material_consumption_unit: string | null
  customer_entity_name: string | null
  material_type_id: number
}

export type DataMessage = {
  material_name: string | null
  material_consumption_unit: string | null
  current_stock: string | number | bigint
  customer_entity_name: string | null
  current_date: string
  material_type_id: number
  min_stock?: number | string | null
  max_stock?: number | string | null
}

export type StockGroupExporter = {
  id: string
  name: string
  sheets: { [key: string]: { sheetName: string } }
  columns: { [key: string]: { header: string; width: number }[] }
}
