import {
  EntityTags,
  Locations,
  WsBatches,
  WsEntities,
  WsMaterials,
  WsOrderLists,
  WsStocks,
  WsTransactionLists,
} from "./db.js"

export interface Datamart {
  raw_ws_entities: WsEntities
  raw_entity_tags: EntityTags
  raw_locations: Locations
  raw_ws_stocks: WsStocks
  raw_ws_materials: WsMaterials
  raw_ws_batches: WsBatches
  raw_ws_entities: WsEntities
  datamart_transaction_list_v5: WsTransactionLists
  datamart_order_list_v5: WsOrderLists
}
