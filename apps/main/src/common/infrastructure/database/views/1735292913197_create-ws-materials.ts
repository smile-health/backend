import type { Kysely } from "kysely"
import { DB } from "../types/db.js"

export async function seed(db: Kysely<DB>): Promise<void> {
  await db.schema
    .createView("ws_materials")
    .orReplace()
    .as(
      db
        .selectFrom("material_workspaces as mw")
        .innerJoin("materials as m", "m.id", "mw.material_id")
        .leftJoin("material_relations as mr", "mr.child_material_id", "m.id")
        .leftJoin("material_workspaces as p", (join) =>
          join
            .onRef("p.material_id", "=", "mr.parent_material_id")
            .onRef("p.workspace_id", "=", "mw.workspace_id")
        )
        .innerJoin("material_units as cu", "cu.id", "m.unit_of_consumption_id")
        .innerJoin("material_units as du", "du.id", "m.unit_of_distribution_id")
        .innerJoin("material_types as mt", "mt.id", "m.material_type_id")
        .leftJoin("material_subtypes as ms", "ms.id", "m.material_subtype_id")
        .innerJoin("material_levels as ml", "ml.id", "m.material_level_id")
        .select([
          "mw.id as id",
          "m.id as global_id",
          "mr.parent_material_id as parent_global_id",
          "p.id as parent_id",
          "mw.workspace_id as program_id",
          "mw.status",
          "mw.is_open_vial",
          "mw.is_addremove",
          "m.name",
          "m.description",
          "m.material_level_id",
          "ml.name as material_level",
          "m.code",
          "m.hierarchy_code",
          "m.unit_of_consumption_id",
          "cu.name as unit_of_consumption",
          "du.name as unit_of_distribution",
          "m.unit_of_distribution_id",
          "m.consumption_unit_per_distribution_unit",
          "m.is_temperature_sensitive",
          "m.min_retail_price",
          "m.max_retail_price",
          "m.min_temperature",
          "m.max_temperature",
          "m.material_type_id",
          "mt.name as material_type",
          "m.material_subtype_id",
          "ms.name as material_subtype",
          "m.is_managed_in_batch",
          "m.is_stock_opname_mandatory",
          "mw.created_by",
          "mw.updated_by",
          "mw.deleted_by",
          "m.created_at",
          "m.updated_at",
          "m.deleted_at",
        ])
    )
    .execute()
}
