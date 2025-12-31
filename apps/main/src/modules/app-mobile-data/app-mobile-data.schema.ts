import {
  WsBatches,
  WsEntityMaterialStocks,
  WsMaterialCompanions,
  WsMaterials,
  WsTransactionReasons,
  WsTransactionTypes
} from "@/common/infrastructure/database/types/db.js"
import { Selectable } from "kysely"
import { ActivitiesDTO } from "../activity/activity.schema.js"
import { EntityTagsDTO } from "../entity-tag/entity-tag.schema.js"
import { EntityDTO } from "../entity/entity.schema.js"

export interface AppMobileCustomerVendorDTO extends EntityDTO {
  entity_tags: EntityTagsDTO[]
}

export interface AppMobileActivitiesDTO extends ActivitiesDTO {}

export interface AppMobileTransactionTypesDTO
  extends Selectable<WsTransactionTypes> {
  transaction_reasons: Selectable<WsTransactionReasons>[]
}

export type WsEntityMaterialActivityDTO = {
  material_level_id: number | null
  parent_id: number | null
  min: number | null
  max: number | null
  material_id: number
  activity_id: number
}

export type WsMaterialDTO = Selectable<WsMaterials>

export type WsEntityMaterialStockDTO = Selectable<WsEntityMaterialStocks>

export type WsMaterialCompanionsDTO = Selectable<WsMaterialCompanions>

export type WsBatchesDTO = Selectable<WsBatches>

export interface ListTransactionTypeReasonDTO {
  result: AppMobileTransactionTypesDTO[]
}

export interface ListCustomerVendorActivityDTO {
  customers: AppMobileCustomerVendorDTO[]
  customer_consumptions: AppMobileCustomerVendorDTO[]
  vendors: AppMobileCustomerVendorDTO[]
  origin_activities: AppMobileActivitiesDTO[]
  activities: AppMobileActivitiesDTO[]
}

export interface ListMaterialStockEntityDTO {}

export interface ListStockEdNearCombinedDTO {
  total: number
  total_material: number
  activities: {
    activity_id: number
    activity_name: string
    total: number
    materials: {
      material_id: number
      material_name: string
      total: number
    }[]
  }[]
}

export interface ListNotifStockEdDTO {
  stock_ed: ListStockEdNearCombinedDTO
  stock_near_ed: ListStockEdNearCombinedDTO
  stock_combine_ed_near_ed_stock: ListStockEdNearCombinedDTO
}
