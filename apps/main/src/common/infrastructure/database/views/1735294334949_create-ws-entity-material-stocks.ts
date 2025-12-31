import { sql, type Kysely } from "kysely"
import { DB } from "../types/db.js"

export async function seed(db: Kysely<DB>): Promise<void> {
  await db.schema
    .createView("ws_entity_material_stocks")
    .orReplace()
    .as(
      db
        .selectFrom("ws_entity_material_activities as ema")
        .leftJoin("ws_stocks as s", (join) =>
          join
            .onRef("s.entity_id", "=", "ema.entity_id")
            .onRef("s.material_id", "=", "ema.material_id")
            .onRef("s.activity_id", "=", "ema.activity_id")
        )
        .innerJoin("ws_activities as a", "a.id", "ema.activity_id")
        .select([
          "a.program_id",
          "ema.entity_id",
          "ema.material_id",
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
        .groupBy(["a.program_id", "ema.entity_id", "ema.material_id"])
    )
    .execute()
}
