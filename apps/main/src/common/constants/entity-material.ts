import { EntityMaterialDTO } from "@/modules/entity-material/entity-material.schema.js";

export const DEFAULT_DATA_ENTITY_MATERIAL: EntityMaterialDTO = {
  max: 0,
  min: 0,
  allocated_stock: 0,
  on_hand_stock: 0,
  stock_last_update: null,
  total_open_vial: 0,
  extermination_discard_qty: 0,
  extermination_qty: 0,
  extermination_received_qty: 0,
  extermination_shipped_qty: 0,
  updated_at: new Date(),
  updated_by: null,
  deleted_at: null,
  deleted_by: null,
};
