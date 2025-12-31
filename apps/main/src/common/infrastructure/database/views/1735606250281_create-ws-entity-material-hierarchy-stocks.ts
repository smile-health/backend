import { sql, type Kysely } from "kysely"
import { DB } from "../types/db.js"

export async function seed(db: Kysely<DB>): Promise<void> {
  await db.schema
    .createView("ws_entity_material_hierarchy_stocks")
    .orReplace()
    .as(
      db
        .selectFrom("ws_stocks as s")
        .leftJoin("ws_entity_material_activities as ema", (join) =>
          join
            .onRef("s.entity_id", "=", "ema.entity_id")
            .onRef("s.material_id", "=", "ema.material_id")
            .onRef("s.activity_id", "=", "ema.activity_id")
        )
        .innerJoin("ws_entities as e", "e.id", "s.entity_id")
        .select([
          "e.program_id",
          "s.entity_id",
          "s.parent_material_id as material_id",
          sql`coalesce(max(ema.min), 0)`.as("min"),
          sql`coalesce(max(ema.max), 0)`.as("max"),
          sql`coalesce(sum(s.qty), 0)`.as("total_qty"),
          sql`coalesce(sum(s.in_transit_qty), 0)`.as("total_in_transit_qty"),
          sql`coalesce(sum(s.allocated_qty), 0)`.as("total_allocated_qty"),
          sql`coalesce(sum(s.open_vial_qty), 0)`.as("total_open_vial_qty"),
          sql`coalesce(sum(s.exterminated_qty), 0)`.as(
            "total_exterminated_qty"
          ),
          sql`coalesce(sum(s.qty - s.allocated_qty), 0)`.as(
            "total_available_qty"
          ),
          sql`max(s.updated_at)`.as("updated_at"),
        ])
        .where("s.parent_material_id", "is not", null)
        .groupBy(["e.program_id", "s.entity_id", "s.parent_material_id"])
    )
    .execute()
}
